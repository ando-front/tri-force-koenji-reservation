import * as admin from 'firebase-admin';
import {
  Facility,
  WeekdayHours,
  CreateFacilityInput,
  UpdateFacilityInput,
  Reservation,
  ReservationStatus,
  AuditAction,
  AuditLog,
  DEFAULT_USAGE_GUIDE_CONTENT,
  ListAuditLogsQuery,
  ListReservationsQuery,
  UpdateUsageGuideContentInput,
  UsageGuideContent,
  UsageGuideContentDoc,
} from '../../../shared/types';

const USAGE_GUIDE_DOC = 'usage-guide';

const db = () => admin.firestore();

function normalizeDateList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort();
}

function normalizeWeekdayHours(value: unknown): WeekdayHours[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => ({
      weekday: Number(item.weekday),
      openHour: Number(item.openHour),
      closeHour: Number(item.closeHour),
      ...(item.slotDurationMinutes !== undefined && item.slotDurationMinutes !== null
        ? { slotDurationMinutes: Number(item.slotDurationMinutes) }
        : {}),
    }))
    .filter((wh) => wh.weekday >= 0 && wh.weekday <= 6)
    .sort((a, b) => a.weekday - b.weekday);
}

function normalizeFacility(docId: string, data: Record<string, unknown>): Facility {
  const nowFallback = null;

  return {
    facilityId: data.facilityId as string ?? docId,
    name: data.name as string ?? docId,
    capacity: Number(data.capacity ?? 1),
    openHour: Number(data.openHour ?? 10),
    closeHour: Number(data.closeHour ?? 22),
    slotDurationMinutes: Number(data.slotDurationMinutes ?? 60),
    closedWeekdays: Array.isArray(data.closedWeekdays)
      ? data.closedWeekdays.map((value) => Number(value))
      : [],
    maintenanceDates: normalizeDateList(data.maintenanceDates),
    weekdayHours: normalizeWeekdayHours(data.weekdayHours),
    isActive: Boolean(data.isActive ?? true),
    createdAt: data.createdAt ?? nowFallback,
    updatedAt: data.updatedAt ?? nowFallback,
  };
}

// ─── 施設 ─────────────────────────────────────────────────────────────────────

export async function getFacility(facilityId: string): Promise<Facility | null> {
  const snap = await db().collection('facilities').doc(facilityId).get();
  if (!snap.exists) return null;
  return normalizeFacility(snap.id, snap.data() ?? {});
}

export async function listFacilities(): Promise<Facility[]> {
  const snap = await db()
    .collection('facilities')
    .where('isActive', '==', true)
    .get();
  return snap.docs
    .map((d) => normalizeFacility(d.id, d.data()))
    .sort((left, right) => left.name.localeCompare(right.name, 'ja'));
}

export async function listFacilitiesAdmin(): Promise<Facility[]> {
  const snap = await db().collection('facilities').get();
  return snap.docs
    .map((d) => normalizeFacility(d.id, d.data()))
    .sort((left, right) => left.name.localeCompare(right.name, 'ja'));
}

export async function createFacility(input: CreateFacilityInput): Promise<Facility> {
  const ref = db().collection('facilities').doc(input.facilityId);
  const existing = await ref.get();
  if (existing.exists) {
    throw Object.assign(new Error('ALREADY_EXISTS'), { code: 'ALREADY_EXISTS' });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    ...input,
    maintenanceDates: normalizeDateList(input.maintenanceDates),
    createdAt: now,
    updatedAt: now,
  });

  const saved = await ref.get();
  return normalizeFacility(saved.id, saved.data() ?? {});
}

export async function updateFacility(
  facilityId: string,
  input: UpdateFacilityInput
): Promise<Facility> {
  const ref = db().collection('facilities').doc(facilityId);
  const existing = await ref.get();
  if (!existing.exists) {
    throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
  }

  await ref.set({
    ...input,
    facilityId,
    maintenanceDates: normalizeDateList(input.maintenanceDates),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const updated = await ref.get();
  return normalizeFacility(updated.id, updated.data() ?? {});
}

// ─── 予約 ─────────────────────────────────────────────────────────────────────

/**
 * 予約をトランザクション内で作成する。
 * 重複（定員超過含む）がある場合は Error をスロー。
 */
export async function createReservation(
  data: Omit<Reservation, 'reservationId' | 'createdAt' | 'updatedAt'>
): Promise<Reservation> {
  const reservationRef = db().collection('reservations').doc();

  // 会員セルフサービス照会用のデノーマライズ済みフィールド。
  // email の大小文字・前後空白による取りこぼしを防ぐ。
  const emailLower = data.email.trim().toLowerCase();
  const reservationCode = reservationRef.id.slice(0, 8).toUpperCase();

  await db().runTransaction(async (tx) => {
    // 同一施設・同一日・時間が重複する pending/confirmed 予約を取得
    const conflictSnap = await tx.get(
      db()
        .collection('reservations')
        .where('facilityId', '==', data.facilityId)
        .where('date', '==', data.date)
        .where('startTime', '==', data.startTime)
        .where('status', 'in', ['pending', 'confirmed'])
    );

    // 施設定員を取得（トランザクション内で読む）
    const facilitySnap = await tx.get(db().collection('facilities').doc(data.facilityId));
    const capacity: number = facilitySnap.data()?.capacity ?? 0;

    if (conflictSnap.size >= capacity) {
      throw Object.assign(new Error('CAPACITY_EXCEEDED'), { code: 'CAPACITY_EXCEEDED' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(reservationRef, {
      ...data,
      reservationId:   reservationRef.id,
      reservationCode,
      emailLower,
      createdAt:       now,
      updatedAt:       now,
    });
  });

  const saved = await reservationRef.get();
  return { ...saved.data(), reservationId: saved.id } as Reservation;
}

/** 予約のステータスを更新する */
export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus,
  cancelReason?: string
): Promise<Reservation> {
  const ref = db().collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
  }

  const current = snap.data() as Reservation;

  // ステータス遷移ルール
  if (current.status === 'cancelled') {
    throw Object.assign(new Error('INVALID_TRANSITION'), { code: 'INVALID_TRANSITION' });
  }

  const update: Partial<Reservation> & { updatedAt: unknown } = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (status === 'cancelled') {
    update.cancelledAt  = admin.firestore.FieldValue.serverTimestamp();
    update.cancelReason = cancelReason ?? '';
  }

  await ref.update(update);
  const updated = await ref.get();
  return { ...updated.data(), reservationId: updated.id } as Reservation;
}

/**
 * 予約番号（先頭8文字大文字）とメールアドレスから予約を検索する。
 * 該当がなければ null を返す。
 *
 * 検索は2段階:
 * 1. 正規化済みの `reservationCode` + `emailLower` の等価検索（新規予約向け）
 * 2. デノーマライズ済みフィールドがない既存予約向けフォールバック:
 *    `email` 完全一致で引いてドキュメントIDの先頭8文字と照合
 */
export async function findReservationByCodeAndEmail(
  reservationCode: string,
  email: string
): Promise<Reservation | null> {
  const normalizedCode  = reservationCode.trim().toUpperCase();
  const normalizedEmail = email.trim().toLowerCase();

  // Step 1: デノーマライズ済みフィールドでの等価検索（高速・正確）
  const primary = await db()
    .collection('reservations')
    .where('reservationCode', '==', normalizedCode)
    .where('emailLower',      '==', normalizedEmail)
    .limit(5)
    .get();

  if (!primary.empty) {
    const doc = primary.docs[0];
    return { ...doc.data(), reservationId: doc.id } as Reservation;
  }

  // Step 2: 既存予約向けフォールバック。emailLower が未設定のデータを
  // 救済するため、email フィールドの完全一致を試みる。
  // 大文字小文字が混在して保存されていた場合を考慮し、
  // 入力値そのもの・lower・可能であれば元ケースの両方で検索を行う。
  const fallbackCandidates = Array.from(
    new Set([email.trim(), normalizedEmail])
  ).filter((v) => v.length > 0);

  for (const candidate of fallbackCandidates) {
    const snap = await db()
      .collection('reservations')
      .where('email', '==', candidate)
      .limit(100)
      .get();

    for (const doc of snap.docs) {
      if (doc.id.slice(0, 8).toUpperCase() !== normalizedCode) continue;
      const data = doc.data();
      const storedEmail =
        typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (storedEmail === normalizedEmail) {
        return { ...data, reservationId: doc.id } as Reservation;
      }
    }
  }

  return null;
}

/** 予約を物理削除する */
export async function deleteReservation(reservationId: string): Promise<void> {
  const ref = db().collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
  }
  await ref.delete();
}

/**
 * 指定メールアドレスのアクティブ予約（pending/confirmed × 本日以降）を返す。
 * 会員セルフサービスの「メールで一覧」用途。プライバシー保護のため
 * cancelled / 過去日は返さない。emailLower 正規化フィールドを優先で
 * 検索し、未設定の旧データには email 完全一致でフォールバック。
 *
 * 同一メールに過去予約が大量にある場合でも本日以降のアクティブ予約が
 * 一覧から漏れないよう、Firestore 側では絞り込みなしで取得し、
 * フィルタ後に hardLimit を厳密適用する（複合インデックス回避）。
 */
const FETCH_BATCH = 500;

export async function listActiveReservationsByEmail(
  email: string,
  todayDate: string,
  hardLimit = 50
): Promise<Reservation[]> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedEmail    = email.trim();

  // Step 1: emailLower 等価検索（新規予約向け）。多めに取得してフィルタ後に切り詰める。
  const primary = await db()
    .collection('reservations')
    .where('emailLower', '==', normalizedEmail)
    .limit(FETCH_BATCH)
    .get();

  // Step 2: emailLower 未設定の旧予約向けフォールバック
  const fallbackCandidates = Array.from(
    new Set([trimmedEmail, normalizedEmail])
  ).filter((v) => v.length > 0);

  const fallbackSnaps = await Promise.all(
    fallbackCandidates.map((c) =>
      db()
        .collection('reservations')
        .where('email', '==', c)
        .limit(FETCH_BATCH)
        .get()
    )
  );

  const seen = new Set<string>();
  const merged: Reservation[] = [];
  for (const doc of primary.docs) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    merged.push({ ...doc.data(), reservationId: doc.id } as Reservation);
  }
  for (const snap of fallbackSnaps) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      merged.push({ ...doc.data(), reservationId: doc.id } as Reservation);
    }
  }

  // アクティブ予約のみに絞り、利用日昇順で返す。最後に hardLimit で切り詰める。
  return merged
    .filter((r) => (r.status === 'pending' || r.status === 'confirmed') && r.date >= todayDate)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    })
    .slice(0, hardLimit);
}

/**
 * 指定日の確定予約をすべて取得する（リマインダー送信用途）。
 * Firestore の単一フィールドインデックスのみで動く（date, status の equality）。
 */
export async function listConfirmedReservationsByDate(date: string): Promise<Reservation[]> {
  const snap = await db()
    .collection('reservations')
    .where('date',   '==', date)
    .where('status', '==', 'confirmed')
    .get();
  return snap.docs.map((d) => ({ ...d.data(), reservationId: d.id })) as Reservation[];
}

/** 予約に reminderSentAt を立てる（冪等性保持） */
export async function markReminderSent(reservationId: string): Promise<void> {
  await db().collection('reservations').doc(reservationId).update({
    reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * 指定日付レンジ（inclusive）の予約をすべて取得する。
 * ダッシュボードの集計用途。件数は数百件を想定。
 */
export async function listReservationsByDateRange(
  dateFrom: string,
  dateTo: string
): Promise<Reservation[]> {
  const snap = await db()
    .collection('reservations')
    .where('date', '>=', dateFrom)
    .where('date', '<=', dateTo)
    .get();
  return snap.docs.map((d) => ({ ...d.data(), reservationId: d.id })) as Reservation[];
}

/** 予約一覧を取得する（管理者用） */
export async function listReservations(
  query: ListReservationsQuery
): Promise<{ reservations: Reservation[]; nextCursor?: string }> {
  const { status, facilityId, dateFrom, dateTo, limit = 50, cursor } = query;

  let q: admin.firestore.Query = db().collection('reservations');

  if (status)     q = q.where('status',     '==', status);
  if (facilityId) q = q.where('facilityId', '==', facilityId);
  if (dateFrom)   q = q.where('date', '>=', dateFrom);
  if (dateTo)     q = q.where('date', '<=', dateTo);

  q = q.orderBy('date', 'asc').orderBy('startTime', 'asc').limit(limit + 1);

  if (cursor) {
    const cursorDoc = await db()
      .collection('reservations')
      .doc(Buffer.from(cursor, 'base64').toString())
      .get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const reservations = docs.map((d) => ({
    ...d.data(),
    reservationId: d.id,
  })) as Reservation[];

  let nextCursor: string | undefined;
  if (snap.docs.length > limit) {
    nextCursor = Buffer.from(docs[docs.length - 1].id).toString('base64');
  }

  return { reservations, nextCursor };
}

/** 指定施設・日付の予約状況をスロット単位で取得する */
export async function getReservationSummaryBySlot(
  facilityId: string,
  date: string
): Promise<Map<string, { currentCount: number; reservedNames: string[] }>> {
  const snap = await db()
    .collection('reservations')
    .where('facilityId', '==', facilityId)
    .where('date', '==', date)
    .where('status', 'in', ['pending', 'confirmed'])
    .get();

  const counts = new Map<string, { currentCount: number; reservedNames: string[] }>();
  const anonymousCounts = new Map<string, number>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const startTime = data.startTime as string;
    const current = counts.get(startTime) ?? { currentCount: 0, reservedNames: [] };
    current.currentCount += 1;
    if (typeof data.memberName === 'string' && data.memberName.trim()) {
      current.reservedNames.push(data.memberName.trim());
    } else {
      const nextAnonymousIndex = (anonymousCounts.get(startTime) ?? 0) + 1;
      anonymousCounts.set(startTime, nextAnonymousIndex);
      current.reservedNames.push(`会員${nextAnonymousIndex}`);
    }
    counts.set(startTime, current);
  }
  return counts;
}

// ─── 監査ログ ──────────────────────────────────────────────────────────────────

// ─── 利用案内コンテンツ ────────────────────────────────────────────────────────

/** Firestore 上の値を `ContentLineSchema` 相当に正規化する */
const MAX_CONTENT_LINES = 20;
const MAX_CONTENT_LINE_LENGTH = 500;

function sanitizeContentLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, MAX_CONTENT_LINE_LENGTH);
    if (trimmed.length === 0) continue;
    cleaned.push(trimmed);
    if (cleaned.length >= MAX_CONTENT_LINES) break;
  }
  return cleaned;
}

/**
 * 利用案内ページの動的文言を取得する。文書がない／配列が壊れているときは
 * 各リスト単位でデフォルトにフォールバックする。空文字や20件超過などの
 * 汚染データは公開ページに出さないよう正規化する。
 */
export async function getUsageGuideContent(): Promise<UsageGuideContentDoc> {
  const snap = await db().collection('siteContent').doc(USAGE_GUIDE_DOC).get();
  if (!snap.exists) {
    return { ...DEFAULT_USAGE_GUIDE_CONTENT };
  }
  const data = snap.data() ?? {};
  const sanitizedSteps = sanitizeContentLines(data.reservationSteps);
  const sanitizedNotes = sanitizeContentLines(data.notes);

  return {
    reservationSteps: sanitizedSteps.length > 0 ? sanitizedSteps : DEFAULT_USAGE_GUIDE_CONTENT.reservationSteps,
    notes:            Array.isArray(data.notes) ? sanitizedNotes : DEFAULT_USAGE_GUIDE_CONTENT.notes,
    updatedAt:        data.updatedAt,
    updatedBy:        typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

/** 利用案内コンテンツを上書き保存する */
export async function setUsageGuideContent(
  input: UpdateUsageGuideContentInput,
  actorUid: string
): Promise<UsageGuideContentDoc> {
  const ref = db().collection('siteContent').doc(USAGE_GUIDE_DOC);
  const payload: UsageGuideContent & { updatedAt: unknown; updatedBy: string } = {
    reservationSteps: input.reservationSteps,
    notes:            input.notes,
    updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    updatedBy:        actorUid,
  };
  await ref.set(payload, { merge: false });
  const saved = await ref.get();
  const data = saved.data() ?? {};
  return {
    reservationSteps: data.reservationSteps as string[],
    notes:            data.notes as string[],
    updatedAt:        data.updatedAt,
    updatedBy:        data.updatedBy as string,
  };
}

export async function writeAuditLog(
  actor: string,
  action: AuditAction,
  targetId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db().collection('auditLogs').add({
    actor,
    action,
    targetId,
    payload,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * 監査ログ一覧を取得する（管理者用）。
 * timestamp 降順、cursor は base64 エンコードされた logId。
 *
 * フィルタ（action / actor / targetId）と orderBy('timestamp') の組み合わせで
 * Firestore の複合インデックスが必要になる事態を避けるため、ソートのみ
 * Firestore に任せて等価フィルタはアプリ側で行う。1ページのデフォルトは
 * 50件だが、フィルタによる脱落で空のページにならないよう必要に応じて
 * 内部的に追加ページを取得する。
 */
const AUDIT_LOG_FETCH_BATCH = 200;
const MAX_AUDIT_LOG_SCAN    = 5_000;

export async function listAuditLogs(
  query: ListAuditLogsQuery
): Promise<{ logs: AuditLog[]; nextCursor?: string }> {
  const { action, actor, targetId, limit = 50, cursor } = query;

  const matchesFilter = (data: Partial<AuditLog>): boolean => {
    if (action   && data.action   !== action)   return false;
    if (actor    && data.actor    !== actor)    return false;
    if (targetId && data.targetId !== targetId) return false;
    return true;
  };

  let lastDoc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot | undefined;
  if (cursor) {
    const cursorDoc = await db()
      .collection('auditLogs')
      .doc(Buffer.from(cursor, 'base64').toString())
      .get();
    if (cursorDoc.exists) lastDoc = cursorDoc;
  }

  const matched: admin.firestore.QueryDocumentSnapshot[] = [];
  let scanned = 0;
  let hasMoreInFirestore = true;

  while (matched.length < limit + 1 && scanned < MAX_AUDIT_LOG_SCAN && hasMoreInFirestore) {
    let q: admin.firestore.Query = db()
      .collection('auditLogs')
      .orderBy('timestamp', 'desc')
      .limit(AUDIT_LOG_FETCH_BATCH);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      if (matchesFilter(doc.data() as Partial<AuditLog>)) {
        matched.push(doc);
        if (matched.length >= limit + 1) break;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    hasMoreInFirestore = snap.docs.length === AUDIT_LOG_FETCH_BATCH;
  }

  const docs = matched.slice(0, limit);
  const logs = docs.map((d) => ({
    logId: d.id,
    ...d.data(),
  })) as AuditLog[];

  let nextCursor: string | undefined;
  if (matched.length > limit) {
    nextCursor = Buffer.from(docs[docs.length - 1].id).toString('base64');
  }

  return { logs, nextCursor };
}
