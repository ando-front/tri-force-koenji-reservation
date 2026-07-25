import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../client';
import { facilities, reservations, slotOccupancy } from '../schema';
import { bookReservation, CapacityExceededError, cancelReservation } from './reservations';

// このファイルは実際の Postgres（DATABASE_URL）に対する統合テスト。
// 設計書 付録 C-2/C-3 で手動検証した内容を CI で自動検証できる形にしたもの。
//
//   実行例:
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/tfk pnpm --filter @tfk/db test

const FACILITY_ID = `test-capacity-${randomUUID().slice(0, 8)}`;
const CAPACITY = 10;

describe('bookReservation（B-1/B-5 の DB レベル検証）', () => {
  const db = getDb();

  beforeAll(async () => {
    await db.insert(facilities).values({
      id: FACILITY_ID,
      name: 'テスト施設（定員制御検証用）',
      capacity: CAPACITY,
      openHour: 9,
      closeHour: 21,
      slotDurationMinutes: 60,
      closedWeekdays: [],
      isActive: true,
    });
  });

  afterAll(async () => {
    await db.delete(reservations).where(eq(reservations.facilityId, FACILITY_ID));
    await db.delete(slotOccupancy).where(eq(slotOccupancy.facilityId, FACILITY_ID));
    await db.delete(facilities).where(eq(facilities.id, FACILITY_ID));
    await closeDb();
  });

  function slotAt(hour: number) {
    const startsAt = new Date(`2026-08-01T${String(hour).padStart(2, '0')}:00:00+09:00`);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    return { startsAt, endsAt };
  }

  async function occupancyFor(startsAt: Date) {
    const [occ] = await db
      .select()
      .from(slotOccupancy)
      .where(and(eq(slotOccupancy.facilityId, FACILITY_ID), eq(slotOccupancy.startsAt, startsAt)));
    return occ;
  }

  it('定員10名の枠に5名 → 4名は合計9名で成功する', async () => {
    const { startsAt, endsAt } = slotAt(9);
    const r1 = await bookReservation(db, {
      facilityId: FACILITY_ID,
      startsAt,
      endsAt,
      memberName: 'A',
      email: 'a@example.com',
      participants: 5,
      purpose: 'テスト',
      remarks: '',
      idempotencyKey: randomUUID(),
    });
    const r2 = await bookReservation(db, {
      facilityId: FACILITY_ID,
      startsAt,
      endsAt,
      memberName: 'B',
      email: 'b@example.com',
      participants: 4,
      purpose: 'テスト',
      remarks: '',
      idempotencyKey: randomUUID(),
    });
    expect(r1.alreadyExisted).toBe(false);
    expect(r2.alreadyExisted).toBe(false);

    const occ = await occupancyFor(startsAt);
    expect(occ?.participantsTotal).toBe(9);
  });

  it('さらに3名（合計12名）は within_capacity 制約で拒否され、占有は9名のまま', async () => {
    const { startsAt, endsAt } = slotAt(9);
    await expect(
      bookReservation(db, {
        facilityId: FACILITY_ID,
        startsAt,
        endsAt,
        memberName: 'C',
        email: 'c@example.com',
        participants: 3,
        purpose: 'テスト',
        remarks: '',
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(CapacityExceededError);

    const occ = await occupancyFor(startsAt);
    expect(occ?.participantsTotal).toBe(9); // ロールバックされ増えていない

    const rows = await db
      .select()
      .from(reservations)
      .where(eq(reservations.facilityId, FACILITY_ID));
    expect(rows).toHaveLength(2); // 拒否された3件目の予約は作られていない
  });

  it('同一 idempotencyKey を再送すると新規作成されず既存IDを返す', async () => {
    const { startsAt, endsAt } = slotAt(11);
    const key = randomUUID();
    const input = {
      facilityId: FACILITY_ID,
      startsAt,
      endsAt,
      memberName: 'D',
      email: 'd@example.com',
      participants: 2,
      purpose: 'テスト',
      remarks: '',
      idempotencyKey: key,
    };
    const first = await bookReservation(db, input);
    const second = await bookReservation(db, input);

    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect(second.reservationId).toBe(first.reservationId);

    const rows = await db.select().from(reservations).where(eq(reservations.idempotencyKey, key));
    expect(rows).toHaveLength(1); // 予約は2件にならず1件のまま
  });

  it('キャンセル後、枠の占有人数が戻る', async () => {
    const { startsAt, endsAt } = slotAt(13);
    const { reservationId } = await bookReservation(db, {
      facilityId: FACILITY_ID,
      startsAt,
      endsAt,
      memberName: 'E',
      email: 'e@example.com',
      participants: 4,
      purpose: 'テスト',
      remarks: '',
      idempotencyKey: randomUUID(),
    });

    await cancelReservation(db, reservationId, 'test');

    const occ = await occupancyFor(startsAt);
    expect(occ?.participantsTotal).toBe(0);

    const [row] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
    expect(row?.status).toBe('cancelled');
  });

  it('10並列で同一枠に3名ずつ投げても定員を超えない（3件成功・7件拒否）', async () => {
    const { startsAt, endsAt } = slotAt(15); // 定員10、参加人数3 × 10件 = 最大30名を同時投入
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        bookReservation(db, {
          facilityId: FACILITY_ID,
          startsAt,
          endsAt,
          memberName: `P${i}`,
          email: `p${i}@example.com`,
          participants: 3,
          purpose: 'テスト',
          remarks: '',
          idempotencyKey: randomUUID(),
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(7);

    const occ = await occupancyFor(startsAt);
    expect(occ?.participantsTotal).toBe(9);
    expect(occ!.participantsTotal).toBeLessThanOrEqual(occ!.capacitySnapshot);
  });
});
