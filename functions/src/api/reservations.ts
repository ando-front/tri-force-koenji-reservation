import { Router, Request, Response } from 'express';
import {
  createReservation,
  getFacility,
  getReservationById,
  listReservations,
  updateReservationStatus,
  deleteReservation,
  writeAuditLog,
  getDashboardStats,
  getAuditLogs,
} from '../infra/firestoreRepository';
import { isFacilityUnavailableOnDate, isWithinOperatingHours, calcEndTime } from '../domain/availability';
import { sendReservationConfirmation }          from '../domain/notification';
import { requireAdmin, getActor }               from './middleware';
import {
  CreateReservationSchema,
  UpdateStatusSchema,
  ListReservationsQuery,
  ReservationStatus,
} from '../../../shared/types';
import type { ZodIssue } from 'zod';

const router = Router();

// ─── 公開API ──────────────────────────────────────────────────────────────────

/** POST /reservations — 予約登録（認証不要） */
router.post('/', async (req: Request, res: Response) => {
  // バリデーション
  const parsed = CreateReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    parsed.error.errors.forEach((e: ZodIssue) => {
      fields[e.path.join('.')] = e.message;
    });
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください', fields },
    });
    return;
  }

  const input = parsed.data;

  // 施設チェック
  const facility = await getFacility(input.facilityId);
  if (!facility || !facility.isActive) {
    res.status(400).json({
      success: false,
      error: { code: 'FACILITY_NOT_FOUND', message: '施設が見つかりません' },
    });
    return;
  }

  if (isFacilityUnavailableOnDate(facility, input.date)) {
    res.status(400).json({
      success: false,
      error: { code: 'FACILITY_UNAVAILABLE', message: '定休日またはメンテナンス日のため予約できません' },
    });
    return;
  }

  // 営業時間チェック
  if (!isWithinOperatingHours(facility, input.date, input.startTime)) {
    res.status(400).json({
      success: false,
      error: { code: 'OUTSIDE_OPERATING_HOURS', message: '営業時間外の時間帯です' },
    });
    return;
  }

  // 定員チェック付き予約登録（トランザクション）
  try {
    const reservation = await createReservation({
      memberName:   input.memberName.trim(),
      email:        input.email,
      facilityId:   input.facilityId,
      facilityName: facility.name,
      date:         input.date,
      startTime:    input.startTime,
      endTime:      calcEndTime(input.startTime, facility.slotDurationMinutes),
      purpose:      input.purpose,
      participants: input.participants,
      remarks:      input.remarks ?? '',
      status:       'pending',
    });

    // 監査ログ
    await writeAuditLog('system', 'reservation.created', reservation.reservationId, {
      memberName: reservation.memberName,
      email:      reservation.email,
      date:       reservation.date,
      startTime:  reservation.startTime,
      facilityId: reservation.facilityId,
    });

    // メール送信（非同期・失敗しても続行）
    sendReservationConfirmation(reservation).catch(() => {/* already logged */});

    res.status(201).json({
      success:       true,
      reservationId: reservation.reservationId,
      message:       '予約を受け付けました。確認メールをお送りしました。',
    });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'CAPACITY_EXCEEDED') {
      res.status(409).json({
        success: false,
        error: { code: 'CAPACITY_EXCEEDED', message: '選択した時間帯は満員です。別の時間をお選びください。' },
      });
      return;
    }
    throw err; // 想定外エラーはExpressエラーハンドラに委譲
  }
});

/** GET /reservations/:id/cancel — キャンセル用予約詳細取得（トークン認証） */
router.get('/:id/cancel', async (req: Request, res: Response) => {
  const { token } = req.query as Record<string, string>;
  if (!token) {
    res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'キャンセルトークンが必要です' } });
    return;
  }

  const reservation = await getReservationById(req.params.id);
  if (!reservation || reservation.cancelToken !== token) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '予約が見つかりません' } });
    return;
  }

  // cancelToken はフロントに返さない
  const { cancelToken: _unused, ...safe } = reservation; // eslint-disable-line @typescript-eslint/no-unused-vars
  res.json({ success: true, reservation: safe });
});

/** POST /reservations/:id/cancel — ユーザー自身による予約キャンセル（トークン認証） */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'キャンセルトークンが必要です' } });
    return;
  }

  const reservation = await getReservationById(req.params.id);
  if (!reservation || reservation.cancelToken !== token) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '予約が見つかりません' } });
    return;
  }

  if (reservation.status === 'cancelled') {
    res.status(409).json({ success: false, error: { code: 'ALREADY_CANCELLED', message: 'この予約は既にキャンセルされています' } });
    return;
  }

  try {
    const updated = await updateReservationStatus(req.params.id, 'cancelled', 'ユーザーによるキャンセル');
    await writeAuditLog('system', 'reservation.cancelled', req.params.id, { cancelledBy: 'user' });
    res.json({ success: true, reservation: updated });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'INVALID_TRANSITION') {
      res.status(409).json({ success: false, error: { code: 'INVALID_TRANSITION', message: 'この予約はキャンセルできません' } });
      return;
    }
    throw err;
  }
});

// ─── 管理者API ───────────────────────────────────────────────────────────────

/** GET /admin/dashboard — ダッシュボード統計 */
router.get('/admin/dashboard', requireAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  // JST で日付を計算
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split('T')[0];

  // 今週の月曜日
  const dayOfWeek = jst.getUTCDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStartDate = new Date(jst);
  weekStartDate.setUTCDate(jst.getUTCDate() - mondayOffset);
  const weekStart = weekStartDate.toISOString().split('T')[0];

  // 今月1日
  const monthStart = `${today.slice(0, 7)}-01`;

  const stats = await getDashboardStats(today, weekStart, monthStart);
  res.json({ success: true, ...stats });
});

/** GET /admin/reservations/:id/audit-logs — 予約の監査ログ */
router.get('/admin/:id/audit-logs', requireAdmin, async (req: Request, res: Response) => {
  const logs = await getAuditLogs(req.params.id);
  res.json({ success: true, logs });
});

/** GET /admin/reservations — 予約一覧 */
router.get('/admin', requireAdmin, async (req: Request, res: Response) => {
  const { status, facilityId, dateFrom, dateTo, limit, cursor } = req.query as Record<string, string>;

  const query: ListReservationsQuery = {
    status:     (status as ReservationStatus) || undefined,
    facilityId: facilityId || undefined,
    dateFrom:   dateFrom   || undefined,
    dateTo:     dateTo     || undefined,
    limit:      limit ? Math.min(Number(limit), 200) : 50,
    cursor:     cursor     || undefined,
  };

  const result = await listReservations(query);
  res.json({ success: true, ...result });
});

/** GET /admin/reservations/:id — 予約詳細 */
router.get('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  const reservation = await getReservationById(req.params.id);
  if (!reservation) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '予約が見つかりません' } });
    return;
  }
  res.json({ success: true, reservation });
});

/** PATCH /admin/reservations/:id/status — ステータス更新 */
router.patch('/admin/:id/status', requireAdmin, async (req: Request, res: Response) => {
  const parsed = UpdateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください' },
    });
    return;
  }

  const { status, cancelReason } = parsed.data;

  try {
    const updated = await updateReservationStatus(req.params.id, status, cancelReason);

    const action = status === 'confirmed' ? 'reservation.confirmed' : 'reservation.cancelled';
    await writeAuditLog(getActor(req), action, req.params.id, { status, cancelReason });

    res.json({ success: true, reservation: updated });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '予約が見つかりません' } });
      return;
    }
    if (e.code === 'INVALID_TRANSITION') {
      res.status(409).json({ success: false, error: { code: 'INVALID_TRANSITION', message: 'ステータスを変更できません' } });
      return;
    }
    throw err;
  }
});

/** DELETE /admin/reservations/:id — 予約削除 */
router.delete('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    // 削除前にスナップショットを取得して監査ログに保存
    const snapshot = await getReservationById(req.params.id);

    await deleteReservation(req.params.id);
    await writeAuditLog(getActor(req), 'reservation.deleted', req.params.id, (snapshot as unknown as Record<string, unknown>) ?? {});

    res.json({ success: true });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '予約が見つかりません' } });
      return;
    }
    throw err;
  }
});

/** GET /admin/export — CSV エクスポート */
router.get('/admin/export', requireAdmin, async (req: Request, res: Response) => {
  const { status, facilityId, dateFrom, dateTo } = req.query as Record<string, string>;

  const { reservations } = await listReservations({
    status:     (status as ReservationStatus) || undefined,
    facilityId: facilityId || undefined,
    dateFrom:   dateFrom   || undefined,
    dateTo:     dateTo     || undefined,
    limit:      5000,
  });

  const BOM = '\uFEFF';
  const header = '予約番号,会員名,メールアドレス,施設名,利用日,開始時刻,終了時刻,参加人数,利用目的,備考,ステータス,登録日時\n';
  const rows = reservations.map((r) => {
    const createdAt = r.createdAt
      ? new Date((r.createdAt as { _seconds: number })._seconds * 1000).toISOString()
      : '';
    return [
      r.reservationId.slice(0, 8).toUpperCase(),
      r.memberName,
      r.email,
      r.facilityName,
      r.date,
      r.startTime,
      r.endTime,
      r.participants,
      `"${r.purpose.replace(/"/g, '""')}"`,
      `"${(r.remarks ?? '').replace(/"/g, '""')}"`,
      r.status,
      createdAt,
    ].join(',');
  });

  const csv = BOM + header + rows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reservations_${dateFrom ?? ''}_${dateTo ?? ''}.csv"`);
  res.send(csv);
});

export default router;
