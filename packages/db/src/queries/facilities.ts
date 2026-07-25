import type { CreateFacilityInput, Facility, UpdateFacilityInput } from '@tfk/core';
import { and, eq, gte, lt } from 'drizzle-orm';
import type { getDb } from '../client';
import {
  facilities,
  facilityBlockedPeriods,
  facilityClosures,
  facilityWeekdayHours,
  reservationEvents,
  slotOccupancy,
} from '../schema';

export async function listFacilitiesPublic(db: ReturnType<typeof getDb>) {
  return db.query.facilities.findMany({ where: eq(facilities.isActive, true) });
}

/**
 * `packages/core` の空き状況ロジック（generateSlotTemplates / toAvailabilitySlots）が
 * 必要とする形（旧 Firestore の配列フィールドと同じ形）に、正規化された子テーブルの
 * 内容を組み立て直す。DB 行 → core の Facility 型への変換はこの db パッケージの責務。
 */
export async function getFacilityWithSchedule(
  db: ReturnType<typeof getDb>,
  facilityId: string,
): Promise<Facility | null> {
  const facility = await db.query.facilities.findFirst({ where: eq(facilities.id, facilityId) });
  if (!facility) return null;

  const [weekdayHours, blockedPeriods, closures] = await Promise.all([
    db.query.facilityWeekdayHours.findMany({
      where: eq(facilityWeekdayHours.facilityId, facilityId),
    }),
    db.query.facilityBlockedPeriods.findMany({
      where: eq(facilityBlockedPeriods.facilityId, facilityId),
    }),
    db.query.facilityClosures.findMany({ where: eq(facilityClosures.facilityId, facilityId) }),
  ]);

  return {
    id: facility.id,
    name: facility.name,
    capacity: facility.capacity,
    openHour: facility.openHour,
    closeHour: facility.closeHour,
    slotDurationMinutes: facility.slotDurationMinutes,
    closedWeekdays: facility.closedWeekdays,
    maintenanceDates: closures.map((c) => c.closedOn),
    isActive: facility.isActive,
    weekdayHours: weekdayHours.map((wh) => ({
      weekday: wh.weekday,
      openHour: wh.openHour,
      closeHour: wh.closeHour,
      slotDurationMinutes: wh.slotDurationMinutes ?? undefined,
    })),
    blockedPeriods: blockedPeriods.map((bp) => ({
      startTime: bp.startTime,
      endTime: bp.endTime,
      weekdays: bp.weekdays ?? undefined,
      dates: bp.dates ?? undefined,
    })),
  };
}

/** 指定施設・指定日の枠占有状況を { startsAt(ISO) -> participantsTotal } の Map で返す。 */
export async function getOccupancyForDate(
  db: ReturnType<typeof getDb>,
  facilityId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select()
    .from(slotOccupancy)
    .where(
      and(
        eq(slotOccupancy.facilityId, facilityId),
        gte(slotOccupancy.startsAt, dayStart),
        lt(slotOccupancy.startsAt, dayEnd),
      ),
    );

  return new Map(rows.map((r) => [r.startsAt.toISOString(), r.participantsTotal]));
}

export async function listFacilitiesAdmin(db: ReturnType<typeof getDb>) {
  // weekdayHours / blockedPeriods は正規化された子テーブルなので、必要な画面側で
  // 個別に facilityWeekdayHours / facilityBlockedPeriods を facilityId で問い合わせる。
  // (旧 Firestore 実装の normalizeWeekdayHours / normalizeBlockedPeriods 相当の
  //  「配列フィールドを都度パースする」約70行のコードは、正規化テーブル化により不要になった）
  return db.query.facilities.findMany();
}

/**
 * 施設作成。B-6 の根治: 旧実装は `console.log` のみで監査ログに残らなかったが、
 * ここでは同一トランザクションで `reservation_events` に必ず書き込む。
 */
export async function createFacility(
  db: ReturnType<typeof getDb>,
  input: CreateFacilityInput,
  actor: string,
) {
  return db.transaction(async (tx) => {
    const [facility] = await tx
      .insert(facilities)
      .values({
        id: input.id,
        name: input.name,
        capacity: input.capacity,
        openHour: input.openHour,
        closeHour: input.closeHour,
        slotDurationMinutes: input.slotDurationMinutes,
        closedWeekdays: input.closedWeekdays,
        isActive: input.isActive,
      })
      .returning();

    if (input.weekdayHours.length > 0) {
      await tx.insert(facilityWeekdayHours).values(
        input.weekdayHours.map((wh) => ({
          facilityId: input.id,
          weekday: wh.weekday,
          openHour: wh.openHour,
          closeHour: wh.closeHour,
          slotDurationMinutes: wh.slotDurationMinutes,
        })),
      );
    }
    if (input.blockedPeriods.length > 0) {
      await tx.insert(facilityBlockedPeriods).values(
        input.blockedPeriods.map((bp) => ({
          facilityId: input.id,
          startTime: bp.startTime,
          endTime: bp.endTime,
          weekdays: bp.weekdays,
          dates: bp.dates,
        })),
      );
    }

    await tx.insert(reservationEvents).values({
      action: 'facility.created',
      actor,
      targetId: input.id,
      payload: input,
    });

    return facility!;
  });
}

export async function updateFacility(
  db: ReturnType<typeof getDb>,
  facilityId: string,
  input: UpdateFacilityInput,
  actor: string,
) {
  return db.transaction(async (tx) => {
    const [facility] = await tx
      .update(facilities)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(facilities.id, facilityId))
      .returning();

    // B-6: 施設マスタの変更を必ず監査ログへ記録する（旧実装は console.log のみだった）
    await tx.insert(reservationEvents).values({
      action: 'facility.updated',
      actor,
      targetId: facilityId,
      payload: input,
    });

    return facility;
  });
}
