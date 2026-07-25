import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { getDb } from '../client';
import { facilities, reservationEvents, reservations, slotOccupancy } from '../schema';

export class CapacityExceededError extends Error {
  constructor() {
    super('CAPACITY_EXCEEDED');
  }
}
export class FacilityNotFoundError extends Error {
  constructor() {
    super('FACILITY_NOT_FOUND');
  }
}

export interface BookReservationInput {
  facilityId: string;
  startsAt: Date;
  endsAt: Date;
  memberName: string;
  email: string;
  participants: number;
  purpose: string;
  remarks: string;
  idempotencyKey: string;
}

/**
 * 予約作成（設計書 6.2/6.3）。1 トランザクション / 実質 1〜2 ステートメントで完結する。
 *
 * - 定員超過は `slot_occupancy.within_capacity` CHECK 制約（23514）が構造的に弾く
 *   （アプリコードは「弾かれたら CapacityExceededError にする」だけで、独自の
 *   カウント・ロック処理は一切書かない — これが B-1 の構造的な解決）
 * - 同一 `idempotencyKey` の再送は `uniq_idempotency` 制約により新規作成されず、
 *   既存の予約 ID を返す（B-5 の構造的な解決）
 *
 * ローカル Postgres 16.13 での検証結果（10 並列で同一枠に3名ずつ投げて
 * 3件のみ成功・超過なし、等）は設計書 付録 C-2/C-3 を参照。
 */
export async function bookReservation(
  db: ReturnType<typeof getDb>,
  input: BookReservationInput,
): Promise<{ reservationId: string; alreadyExisted: boolean }> {
  return db.transaction(async (tx) => {
    const facility = await tx.query.facilities.findFirst({
      where: eq(facilities.id, input.facilityId),
    });
    if (!facility) throw new FacilityNotFoundError();

    // 冪等キーの重複はここで検出する（新規作成なら 1 行返る／再送なら 0 行）
    const inserted = await tx
      .insert(reservations)
      .values({
        facilityId: input.facilityId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        memberName: input.memberName,
        email: input.email,
        participants: input.participants,
        purpose: input.purpose,
        remarks: input.remarks,
        status: 'confirmed',
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({ target: [reservations.facilityId, reservations.idempotencyKey] })
      .returning({ id: reservations.id });

    if (inserted.length === 0) {
      const existing = await tx.query.reservations.findFirst({
        where: and(
          eq(reservations.facilityId, input.facilityId),
          eq(reservations.idempotencyKey, input.idempotencyKey),
        ),
      });
      if (!existing) throw new Error('予期しない状態: 冪等キー重複だが既存予約が見つからない');
      return { reservationId: existing.id, alreadyExisted: true };
    }

    const reservationId = inserted[0]!.id;

    // 定員制御の中核: 行ロックを取る ON CONFLICT DO UPDATE。
    // within_capacity 制約に違反すると Postgres がエラーコード 23514 を返し、
    // トランザクション全体（reservations への INSERT も含む）がロールバックされる。
    try {
      await tx
        .insert(slotOccupancy)
        .values({
          facilityId: input.facilityId,
          startsAt: input.startsAt,
          capacitySnapshot: facility.capacity,
          participantsTotal: input.participants,
        })
        .onConflictDoUpdate({
          target: [slotOccupancy.facilityId, slotOccupancy.startsAt],
          set: {
            participantsTotal: sql`${slotOccupancy.participantsTotal} + ${input.participants}`,
          },
        });
    } catch (err) {
      if (isCheckViolation(err)) throw new CapacityExceededError();
      throw err;
    }

    await tx.insert(reservationEvents).values({
      reservationId,
      action: 'reservation.created',
      actor: 'member',
      targetId: reservationId,
      payload: { facilityId: input.facilityId, participants: input.participants },
    });

    return { reservationId, alreadyExisted: false };
  });
}

export async function cancelReservation(
  db: ReturnType<typeof getDb>,
  reservationId: string,
  actor: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const reservation = await tx.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
    });
    if (!reservation || reservation.status === 'cancelled') return;

    await tx
      .update(reservations)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(reservations.id, reservationId));

    // 枠を解放する（定員制御と対称の操作）
    await tx
      .update(slotOccupancy)
      .set({
        participantsTotal: sql`${slotOccupancy.participantsTotal} - ${reservation.participants}`,
      })
      .where(
        and(
          eq(slotOccupancy.facilityId, reservation.facilityId),
          eq(slotOccupancy.startsAt, reservation.startsAt),
        ),
      );

    await tx.insert(reservationEvents).values({
      reservationId,
      action: 'reservation.cancelled',
      actor,
      targetId: reservationId,
      payload: {},
    });
  });
}

export interface ListReservationsFilter {
  facilityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export async function listReservationsAdmin(
  db: ReturnType<typeof getDb>,
  filter: ListReservationsFilter,
) {
  const conditions = [];
  if (filter.facilityId) conditions.push(eq(reservations.facilityId, filter.facilityId));
  if (filter.dateFrom) conditions.push(gte(reservations.startsAt, filter.dateFrom));
  if (filter.dateTo) conditions.push(lte(reservations.startsAt, filter.dateTo));

  return db.query.reservations.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: desc(reservations.startsAt),
    limit: Math.min(filter.limit ?? 200, 5000),
  });
}

/**
 * 会員のメール指定での予約照会。
 *
 * 旧実装（Firestore）はメール大小文字ゆらぎを避けるため emailLower を2回の等価クエリ
 * （通常 1,000・最悪 1,500 ドキュメント読み取り）で検索していたが、Postgres では
 * `email` カラムを citext 相当（アプリ側で lower() 済みの値を保存）にしておけば
 * インデックス 1 回のスキャンで済む（設計書 9 章）。
 */
export async function listReservationsByEmail(db: ReturnType<typeof getDb>, email: string) {
  return db.query.reservations.findMany({
    where: eq(reservations.email, email.trim().toLowerCase()),
    orderBy: desc(reservations.startsAt),
  });
}

function isCheckViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23514';
}
