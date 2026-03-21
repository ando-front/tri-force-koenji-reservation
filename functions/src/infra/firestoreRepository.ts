import * as admin from 'firebase-admin';
import {
  Facility,
  Reservation,
  ReservationStatus,
  AuditAction,
  ListReservationsQuery,
} from '../../../shared/types';

const db = () => admin.firestore();

// ─── 施設 ─────────────────────────────────────────────────────────────────────

export async function getFacility(facilityId: string): Promise<Facility | null> {
  const snap = await db().collection('facilities').doc(facilityId).get();
  if (!snap.exists) return null;
  return { facilityId: snap.id, ...snap.data() } as Facility;
}

export async function listFacilities(): Promise<Facility[]> {
  const snap = await db()
    .collection('facilities')
    .where('isActive', '==', true)
    .orderBy('name')
    .get();
  return snap.docs.map((d) => ({ facilityId: d.id, ...d.data() } as Facility));
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
      reservationId: reservationRef.id,
      createdAt:     now,
      updatedAt:     now,
    });
  });

  const saved = await reservationRef.get();
  return { reservationId: saved.id, ...saved.data() } as Reservation;
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

/** 指定施設・日付の予約件数をスロット単位で取得する */
export async function getReservationCountsBySlot(
  facilityId: string,
  date: string
): Promise<Map<string, number>> {
  const snap = await db()
    .collection('reservations')
    .where('facilityId', '==', facilityId)
    .where('date', '==', date)
    .where('status', 'in', ['pending', 'confirmed'])
    .get();

  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const st: string = doc.data().startTime;
    counts.set(st, (counts.get(st) ?? 0) + 1);
  }
  return counts;
}

// ─── 監査ログ ──────────────────────────────────────────────────────────────────

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
