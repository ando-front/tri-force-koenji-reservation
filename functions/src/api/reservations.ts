import { Router, Request, Response } from 'express';
import {
  createReservation,
  getFacility,
  listReservations,
  updateReservationStatus,
  deleteReservation,
  writeAuditLog,
} from '../infra/firestoreRepository';
import { isWithinOperatingHours, calcEndTime } from '../domain/availability';
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
      memberName:   input.memberName,
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

// ─── 管理者API ───────────────────────────────────────────────────────────────

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
  const { reservations } = await listReservations({ limit: 1 });
  // 個別取得はリポジトリ関数を追加するか、一覧から取得する簡易実装
  const snap = await require('firebase-admin')
    .firestore()
    .collection('reservations')
    .doc(req.params.id)
    .get();

  if (!snap.exists) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '予約が見つかりません' } });
    return;
  }
  res.json({ success: true, reservation: { reservationId: snap.id, ...snap.data() } });
  void reservations; // suppress unused warning
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
    const snap = await require('firebase-admin')
      .firestore()
      .collection('reservations')
      .doc(req.params.id)
      .get();

    await deleteReservation(req.params.id);
    await writeAuditLog(getActor(req), 'reservation.deleted', req.params.id, snap.data() ?? {});

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
