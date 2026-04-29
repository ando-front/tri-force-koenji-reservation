import { Facility, AvailabilitySlot, WeekdayHours, BlockedPeriod } from '../../../shared/types';

export function isFacilityUnavailableOnDate(facility: Facility, date: string): boolean {
  const weekday = new Date(date + 'T00:00:00').getDay();
  return facility.closedWeekdays.includes(weekday) || facility.maintenanceDates.includes(date);
}

/**
 * 施設レベルの blockedPeriods を指定日でフィルタリングして返す。
 * - bp.dates が設定されている場合: その日付に含まれる場合のみ有効
 * - bp.weekdays が設定されている場合: その曜日に含まれる場合のみ有効
 * - どちらも未設定: 全日付に有効（全曜日共通）
 */
function filterBlockedPeriodsForDate(blockedPeriods: BlockedPeriod[], date: string): BlockedPeriod[] {
  const weekday = new Date(date + 'T00:00:00').getDay();
  return blockedPeriods.filter((bp) => {
    if (bp.dates && bp.dates.length > 0) return bp.dates.includes(date);
    if (bp.weekdays && bp.weekdays.length > 0) return bp.weekdays.includes(weekday);
    return true; // scope なし = 全曜日共通
  });
}

/**
 * 指定日の曜日に対応する営業時間を返す。
 * weekdayHours に対象曜日の設定があればそれを使い、なければ施設のデフォルトを返す。
 */
export function getHoursForDate(
  facility: Facility,
  date: string,
): { openHour: number; closeHour: number; slotDurationMinutes: number; blockedPeriods: BlockedPeriod[] } {
  const weekday = new Date(date + 'T00:00:00').getDay();
  const override: WeekdayHours | undefined = (facility.weekdayHours ?? []).find(
    (wh) => wh.weekday === weekday,
  );

  // 曜日別設定に blockedPeriods が明示されている場合はそちらを優先（施設レベルを上書き）
  // 未設定（undefined）の場合は施設レベルの blockedPeriods をスコープフィルタして使用
  const blockedPeriods =
    override?.blockedPeriods != null
      ? override.blockedPeriods
      : filterBlockedPeriodsForDate(facility.blockedPeriods ?? [], date);

  return {
    openHour:            override?.openHour            ?? facility.openHour,
    closeHour:           override?.closeHour           ?? facility.closeHour,
    slotDurationMinutes: override?.slotDurationMinutes ?? facility.slotDurationMinutes,
    blockedPeriods,
  };
}

/**
 * スロットがブロック済み時間帯と重なるかチェックする。
 * スロットが blocked period に完全に含まれている場合、または部分的に重なる場合は true を返す。
 */
function isSlotBlocked(
  slotStartMin: number,
  slotEndMin: number,
  blockedPeriods: BlockedPeriod[],
): boolean {
  return blockedPeriods.some((bp) => {
    const bpStart = hhmmToMinutes(bp.startTime);
    const bpEnd   = hhmmToMinutes(bp.endTime);
    // スロットと blocked period に重なりがある場合（接触のみは除外）
    return slotStartMin < bpEnd && slotEndMin > bpStart;
  });
}

/**
 * 施設の営業時間をスロット配列に展開する
 * 各スロットの available / currentCount は呼び出し元が埋める
 */
export function generateSlots(facility: Facility, date: string): Omit<AvailabilitySlot, 'available' | 'currentCount'>[] {
  const slots: Omit<AvailabilitySlot, 'available' | 'currentCount'>[] = [];

  if (isFacilityUnavailableOnDate(facility, date)) return [];

  const { openHour, closeHour, slotDurationMinutes, blockedPeriods } = getHoursForDate(facility, date);

  const totalMinutes = (closeHour - openHour) * 60;
  const slotCount = Math.floor(totalMinutes / slotDurationMinutes);

  for (let i = 0; i < slotCount; i++) {
    const startMin = openHour * 60 + i * slotDurationMinutes;
    const endMin = startMin + slotDurationMinutes;

    if (isSlotBlocked(startMin, endMin, blockedPeriods)) continue;

    slots.push({
      startTime: minutesToHHMM(startMin),
      endTime:   minutesToHHMM(endMin),
      capacity:  facility.capacity,
      reservedNames: [],
    });
  }
  return slots;
}

/** HH:MM 文字列が施設の営業時間内かチェック */
export function isWithinOperatingHours(facility: Facility, date: string, startTime: string): boolean {
  if (isFacilityUnavailableOnDate(facility, date)) return false;

  const { openHour, closeHour, slotDurationMinutes, blockedPeriods } = getHoursForDate(facility, date);
  const startMin = hhmmToMinutes(startTime);
  const endMin = startMin + slotDurationMinutes;
  const openMin  = openHour  * 60;
  const closeMin = closeHour * 60;
  if (startMin < openMin || endMin > closeMin) return false;

  return !isSlotBlocked(startMin, endMin, blockedPeriods);
}

/** startTime から slotDurationMinutes 後の endTime を返す */
export function calcEndTime(startTime: string, slotDurationMinutes: number): string {
  const total = hhmmToMinutes(startTime) + slotDurationMinutes;
  return minutesToHHMM(((total % 1440) + 1440) % 1440);
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
