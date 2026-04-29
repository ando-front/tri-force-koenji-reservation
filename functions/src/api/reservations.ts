import { Router, Request, Response } from 'express';
import {
  createReservation,
  findReservationByCodeAndEmail,
  getFacility,
  listActiveReservationsByEmail,
  listFacilitiesAdmin,
  listReservations,
  listReservationsByDateRange,
  updateReservationStatus,
  deleteReservation,
  writeAuditLog,
} from '../infra/firestoreRepository';
import { isFacilityUnavailableOnDate, isWithinOperatingHours, calcEndTime } from '../domain/availability';
import { todayJst } from '../domain/date';
import { buildDashboardStats, buildDashboardWindows } from '../domain/dashboardStats';
import { sendCancellationNotification, sendReservationConfirmation } from '../domain/notification';
import { rateLimitByIp, requireAdmin, getActor } from './middleware';
import {
  CancelReservationSchema,
  CreateReservationSchema,
  LookupReservationSchema,
  LookupReservationsByEmailSchema,
  PublicReservationSummary,
  PublicReservationView,
  Reservation,
  UpdateStatusSchema,
  ListReservationsQuery,
  ReservationStatus,
} from '../../../shared/types';
import type { ZodIssue } from 'zod';

const router = Router();

/**
 * メール検索の一覧表示用サマリへ落とす。
 * メールアドレス所有のみで照会できるエンドポイントから返るため、
 * reservationCode や利用目的・備考・氏名など個別の機微情報は含めない。
 */
function toPublicSummary(reservation: Reservation): PublicReservationSummary {
  return {
    facilityId:   reservation.facilityId,
    facilityName: reservation.facilityName,
    date:         reservation.date,
    startTime:    reservation.startTime,
    endTime:      reservation.endTime,
    participants: reservation.participants,
    status:       reservation.status,
  };
}

/** 予約エンティティから会員向け表示用の項目だけ抜き出す */
function toPublicView(reservation: Reservation): PublicReservationView {
  return {
    reservationCode: reservation.reservationId.slice(0, 8).toUpperCase(),
    memberName:      reservation.memberName,
    facilityId:      reservation.facilityId,
    facilityName:    reservation.facilityName,
    date:            reservation.date,
    startTime:       reservation.startTime,
    endTime:         reservation.endTime,
    participants:    reservation.participants,
    purpose:         reservation.purpose,
    remarks:         reservation.remarks ?? '',
    status:          reservation.status,
    cancelledAt:     reservation.cancelledAt,
    cancelReason:    reservation.cancelReason,
  };
}


// ─── 公開API ──────────────────────────────────────────────────────────────────

// 公開予約登録のレートリミット。1インスタンスあたり 10分間に 10件 / IP の
// ベストエフォート制限。Cloud Functions v2 ではインスタンスごとに独立して
// カウントされるため、全体での厳密な上限を保証するものではない（最悪ケースで
// maxInstances 倍まで通り得る）。同一IP配下で複数会員が連続登録するケース
// （家族・知人など）も過度に排他しないよう、容量はやや緩めに設定。
const createRateLimit = rateLimitByIp({ windowMs: 10 * 60 * 1000, max: 10, key: 'reservations-create' });

/** POST /reservations — 予約登録（認証不要） */
router.post('/', createRateLimit, async (req: Request, res: Response) => {
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

    // メール送信は send 関数側で例外を握り潰す。
    // Cloud Run では HTTP レスポンス送信後に CPU がスロットルされるため、
    // レスポンスを返す前に await して確実に送信完了させる。
    await sendReservationConfirmation(reservation);

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

// ─── 会員セルフサービス ───────────────────────────────────────────────────────

// 予約番号が見つからない場合でもメールの有無を推測されないよう
// lookup と cancel で共通のメッセージを使う。
const NOT_FOUND_MESSAGE = '予約番号またはメールアドレスが一致しません。';

const lookupRateLimit = rateLimitByIp({ windowMs: 10 * 60 * 1000, max: 20, key: 'lookup' });
const cancelRateLimit = rateLimitByIp({ windowMs: 10 * 60 * 1000, max: 5,  key: 'lookup-cancel' });

/** POST /reservations/lookup — 予約番号＋メールで予約を照会する */
router.post('/lookup', lookupRateLimit, async (req: Request, res: Response) => {
  const parsed = LookupReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください' },
    });
    return;
  }

  const reservation = await findReservationByCodeAndEmail(parsed.data.reservationCode, parsed.data.email);
  if (!reservation) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: NOT_FOUND_MESSAGE },
    });
    return;
  }

  res.json({ success: true, reservation: toPublicView(reservation) });
});

/** POST /reservations/lookup-by-email — メールアドレスから自分のアクティブ予約一覧を取得 */
router.post('/lookup-by-email', lookupRateLimit, async (req: Request, res: Response) => {
  const parsed = LookupReservationsByEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください' },
    });
    return;
  }

  const reservations = await listActiveReservationsByEmail(parsed.data.email, todayJst());
  res.json({
    success: true,
    // セキュリティ: reservationCode を含む PublicReservationView ではなくサマリで返す。
    // 詳細・キャンセルには別途 reservationCode を要求する `lookup`/`lookup/cancel` を経由させる。
    reservations: reservations.map(toPublicSummary),
  });
});

/** POST /reservations/resend-confirmation — 確認メールを再送する（認証不要） */
// 悪用防止のため resend 専用の厳しめレートリミットを設ける。
const resendRateLimit = rateLimitByIp({ windowMs: 10 * 60 * 1000, max: 3, key: 'resend-confirmation' });

router.post('/resend-confirmation', resendRateLimit, async (req: Request, res: Response) => {
  const parsed = LookupReservationsByEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください' },
    });
    return;
  }

  const reservations = await listActiveReservationsByEmail(parsed.data.email, todayJst());

  // プライバシー上、予約の有無は明かさず常に成功を返す。
  // アクティブ予約の確認メールを並列送信し、個別の失敗はログに記録する。
  const results = await Promise.allSettled(reservations.map((r) => sendReservationConfirmation(r)));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[resend-confirmation] email ${i} failed:`, result.reason);
    }
  });

  res.json({ success: true });
});


router.post('/lookup/cancel', cancelRateLimit, async (req: Request, res: Response) => {
  const parsed = CancelReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '入力内容を確認してください' },
    });
    return;
  }

  const reservation = await findReservationByCodeAndEmail(parsed.data.reservationCode, parsed.data.email);
  if (!reservation) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: NOT_FOUND_MESSAGE },
    });
    return;
  }

  if (reservation.status === 'cancelled') {
    res.status(409).json({
      success: false,
      error: { code: 'ALREADY_CANCELLED', message: 'この予約は既にキャンセル済みです。' },
    });
    return;
  }

  // 過去日はキャンセル不可（当日は可）
  if (reservation.date < todayJst()) {
    res.status(409).json({
      success: false,
      error: { code: 'PAST_RESERVATION', message: '過去の予約はキャンセルできません。運営までご連絡ください。' },
    });
    return;
  }

  const reason = parsed.data.cancelReason?.trim() ?? '';
  const cancelReason = reason ? `[会員キャンセル] ${reason}` : '[会員キャンセル]';

  const updated = await updateReservationStatus(reservation.reservationId, 'cancelled', cancelReason);
  await writeAuditLog('member', 'reservation.cancelled', reservation.reservationId, {
    status: 'cancelled',
    cancelReason,
    memberName: reservation.memberName,
    date: reservation.date,
    startTime: reservation.startTime,
    facilityId: reservation.facilityId,
  });

  // キャンセル通知メール（send 側で例外を握り潰す。Cloud Run CPU スロットル対策で await）
  await sendCancellationNotification(updated, {
    triggeredBy:  'member',
    cancelReason: reason,
  });

  res.json({ success: true, reservation: toPublicView(updated) });
});

// ─── 管理者API ───────────────────────────────────────────────────────────────

/**
 * GET /admin/stats — ダッシュボード向け集計
 * 過去30日〜翌7日の予約を1クエリで取得し、集計して返す。
 */
router.get('/admin/stats', requireAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  const win = buildDashboardWindows(now);
  const [reservations, facilities] = await Promise.all([
    listReservationsByDateRange(win.queryFrom, win.queryTo),
    listFacilitiesAdmin(),
  ]);
  const stats = buildDashboardStats(reservations, facilities, now);
  res.json({ success: true, stats });
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
  res.json({ success: true, reservation: { ...snap.data(), reservationId: snap.id } });
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

    // キャンセル時は会員に通知（管理者起因・send 側で例外を握り潰す。Cloud Run CPU スロットル対策で await）
    if (status === 'cancelled') {
      await sendCancellationNotification(updated, {
        triggeredBy:  'admin',
        cancelReason: cancelReason ?? '',
      });
    }

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
