import type { Facility } from './schema';
import { isSlotPast, todayJst } from './time';

type BlockedPeriod = Facility['blockedPeriods'][number];
type WeekdayHours = Facility['weekdayHours'][number];

export interface SlotTemplate {
  startTime: string;
  endTime: string;
  capacity: number;
}

export interface AvailabilitySlot extends SlotTemplate {
  startsAt: Date;
  endsAt: Date;
  currentCount: number;
  available: boolean;
}

/**
 * このファイルは旧 functions/src/domain/availability.ts をほぼそのまま移植したもの
 * （設計書 5.3: core はすでに DB もフレームワークも知らない純関数だったため、
 * リアーキの中で最もリスクが低い部分）。
 *
 * 変更点は 2 つだけ:
 *  1. 日付の曜日判定を `new Date(date + 'T00:00:00')`（ローカルタイムゾーン依存）から
 *     `Asia/Tokyo` 固定の判定に変更（B-3 と同種の落とし穴を先回りして塞ぐ）
 *  2. `generateSlots` が返すテンプレートに `startsAt`/`endsAt`（timestamptz）を含める
 *     ことで、呼び出し側は「HH:MM 文字列 + 別の日付文字列」を持ち歩く必要がなくなる
 */

function weekdayOfJst(date: string): number {
  // date は "YYYY-MM-DD"（JST の日付）。JST 正午のインスタントを作ってから
  // getUTCDay() を読む — その瞬間の UTC 側の日付は常に JST と同じ日なので、
  // ローカルタイムゾーンや日付跨ぎに依存せず曜日を安全に求められる。
  return new Date(`${date}T12:00:00+09:00`).getUTCDay();
}

export function isFacilityUnavailableOnDate(facility: Facility, date: string): boolean {
  const weekday = weekdayOfJst(date);
  return facility.closedWeekdays.includes(weekday) || facility.maintenanceDates.includes(date);
}

function filterBlockedPeriodsForDate(
  blockedPeriods: BlockedPeriod[],
  date: string,
): BlockedPeriod[] {
  const weekday = weekdayOfJst(date);
  return blockedPeriods.filter((bp) => {
    if (bp.dates && bp.dates.length > 0) return bp.dates.includes(date);
    if (bp.weekdays && bp.weekdays.length > 0) return bp.weekdays.includes(weekday);
    return true;
  });
}

export function getHoursForDate(
  facility: Facility,
  date: string,
): {
  openHour: number;
  closeHour: number;
  slotDurationMinutes: number;
  blockedPeriods: BlockedPeriod[];
} {
  const weekday = weekdayOfJst(date);
  const override: WeekdayHours | undefined = (facility.weekdayHours ?? []).find(
    (wh) => wh.weekday === weekday,
  );

  const blockedPeriods = filterBlockedPeriodsForDate(facility.blockedPeriods ?? [], date);

  return {
    openHour: override?.openHour ?? facility.openHour,
    closeHour: override?.closeHour ?? facility.closeHour,
    slotDurationMinutes: override?.slotDurationMinutes ?? facility.slotDurationMinutes,
    blockedPeriods,
  };
}

function isSlotBlocked(
  slotStartMin: number,
  slotEndMin: number,
  blockedPeriods: BlockedPeriod[],
): boolean {
  return blockedPeriods.some((bp) => {
    const bpStart = hhmmToMinutes(bp.startTime);
    const bpEnd = hhmmToMinutes(bp.endTime);
    return slotStartMin < bpEnd && slotEndMin > bpStart;
  });
}

/** 施設の営業時間を「テンプレート」（枠の時刻・定員）の配列に展開する。占有数・過去判定は含まない。 */
export function generateSlotTemplates(facility: Facility, date: string): SlotTemplate[] {
  if (isFacilityUnavailableOnDate(facility, date)) return [];

  const { openHour, closeHour, slotDurationMinutes, blockedPeriods } = getHoursForDate(
    facility,
    date,
  );
  const totalMinutes = (closeHour - openHour) * 60;
  const slotCount = Math.floor(totalMinutes / slotDurationMinutes);
  const slots: SlotTemplate[] = [];

  for (let i = 0; i < slotCount; i++) {
    const startMin = openHour * 60 + i * slotDurationMinutes;
    const endMin = startMin + slotDurationMinutes;
    if (isSlotBlocked(startMin, endMin, blockedPeriods)) continue;

    slots.push({
      startTime: minutesToHHMM(startMin),
      endTime: minutesToHHMM(endMin),
      capacity: facility.capacity,
    });
  }
  return slots;
}

/** "YYYY-MM-DD" + "HH:MM"（JST）を UTC の Date（timestamptz として扱う）に変換する。 */
export function jstWallClockToDate(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+09:00`);
}

/**
 * テンプレートと slot_occupancy の参加人数合計（facilityId+startsAt をキーに持つ Map）から
 * 表示用の AvailabilitySlot 配列を組み立てる。
 *
 * B-3 の根治: 過去判定は `isSlotPast(startsAt, now)` という timestamptz の単純比較になり、
 * JST/UTC を取り違える余地がそもそもない。
 */
export function toAvailabilitySlots(
  facility: Facility,
  date: string,
  occupancyByStart: Map<string, number>,
  now: Date = new Date(),
): AvailabilitySlot[] {
  return generateSlotTemplates(facility, date).map((t) => {
    const startsAt = jstWallClockToDate(date, t.startTime);
    const endsAt = jstWallClockToDate(date, t.endTime);
    const currentCount = occupancyByStart.get(startsAt.toISOString()) ?? 0;
    const past = isSlotPast(startsAt, now);
    return {
      ...t,
      startsAt,
      endsAt,
      currentCount,
      available: !past && currentCount < t.capacity,
    };
  });
}

export function isWithinOperatingHours(
  facility: Facility,
  date: string,
  startTime: string,
): boolean {
  if (isFacilityUnavailableOnDate(facility, date)) return false;

  const { openHour, closeHour, slotDurationMinutes, blockedPeriods } = getHoursForDate(
    facility,
    date,
  );
  const startMin = hhmmToMinutes(startTime);
  const endMin = startMin + slotDurationMinutes;
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  if (startMin < openMin || endMin > closeMin) return false;

  return !isSlotBlocked(startMin, endMin, blockedPeriods);
}

export function calcEndTime(startTime: string, slotDurationMinutes: number): string {
  const total = hhmmToMinutes(startTime) + slotDurationMinutes;
  return minutesToHHMM(((total % 1440) + 1440) % 1440);
}

export { todayJst };

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
