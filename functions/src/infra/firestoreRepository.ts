import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import {
  Facility,
  CreateFacilityInput,
  UpdateFacilityInput,
  Reservation,
  ReservationStatus,
  AuditAction,
  ListReservationsQuery,
} from '../../../shared/types';

const db = () => admin.firestore();

function normalizeDateList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort();
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

/** 施設を物理削除する（予約が存在しない場合のみ） */
export async function deleteFacility(facilityId: string): Promise<void> {
  const ref = db().collection('facilities').doc(facilityId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
  }

  // 関連する有効予約がある場合は削除不可
  const activeReservations = await db()
    .collection('reservations')
    .where('facilityId', '==', facilityId)
    .where('status', 'in', ['pending', 'confirmed'])
    .limit(1)
    .get();

  if (!activeReservations.empty) {
    throw Object.assign(
      new Error('HAS_ACTIVE_RESERVATIONS'),
      { code: 'HAS_ACTIVE_RESERVATIONS' },
    );
  }

  await ref.delete();
}

// ─── 予約 ─────────────────────────────────────────────────────────────────────

/**
 * 予約をトランザクション内で作成する。
 * 重複（定員超過含む）がある場合は Error をスロー。
 */
export async function createReservation(
  data: Omit<Reservation, 'reservationId' | 'cancelToken' | 'createdAt' | 'updatedAt'>
): Promise<Reservation> {
  const reservationRef = db().collection('reservations').doc();

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
    const cancelToken = crypto.randomUUID();
    tx.set(reservationRef, {
      ...data,
      reservationId: reservationRef.id,
      cancelToken,
      createdAt:     now,
      updatedAt:     now,
    });
  });

  const saved = await reservationRef.get();
  return { reservationId: saved.id, ...saved.data() } as Reservation;
}

/** 予約を1件取得する */
export async function getReservationById(reservationId: string): Promise<Reservation | null> {
  const snap = await db().collection('reservations').doc(reservationId).get();
  if (!snap.exists) return null;
  return { reservationId: snap.id, ...snap.data() } as Reservation;
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
  return { reservationId: updated.id, ...updated.data() } as Reservation;
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
    reservationId: d.id,
    ...d.data(),
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

/** ダッシュボード用: 予約統計を集計する */
export async function getDashboardStats(today: string, weekStart: string, monthStart: string): Promise<{
  today:    { total: number; pending: number; confirmed: number; cancelled: number };
  week:     { total: number; pending: number; confirmed: number; cancelled: number };
  month:    { total: number; pending: number; confirmed: number; cancelled: number };
  recent:   Reservation[];
}> {
  // 当月以降の予約を一括取得してメモリ集計（小規模ジムなので十分）
  const snap = await db()
    .collection('reservations')
    .where('date', '>=', monthStart)
    .orderBy('date', 'desc')
    .orderBy('startTime', 'desc')
    .limit(500)
    .get();

  const allReservations = snap.docs.map((d) => ({
    reservationId: d.id,
    ...d.data(),
  })) as Reservation[];

  const count = (list: Reservation[]) => ({
    total:     list.length,
    pending:   list.filter((r) => r.status === 'pending').length,
    confirmed: list.filter((r) => r.status === 'confirmed').length,
    cancelled: list.filter((r) => r.status === 'cancelled').length,
  });

  return {
    today: count(allReservations.filter((r) => r.date === today)),
    week:  count(allReservations.filter((r) => r.date >= weekStart && r.date <= today)),
    month: count(allReservations.filter((r) => r.date >= monthStart)),
    recent: allReservations.slice(0, 10),
  };
}

/** 監査ログを取得する（対象IDで絞り込み） */
export async function getAuditLogs(targetId: string): Promise<Array<{
  logId: string;
  actor: string;
  action: AuditAction;
  targetId: string;
  payload: Record<string, unknown>;
  timestamp: unknown;
}>> {
  const snap = await db()
    .collection('auditLogs')
    .where('targetId', '==', targetId)
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();

  return snap.docs.map((d) => ({
    logId: d.id,
    ...d.data(),
  })) as Array<{
    logId: string;
    actor: string;
    action: AuditAction;
    targetId: string;
    payload: Record<string, unknown>;
    timestamp: unknown;
  }>;
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
