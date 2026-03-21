import { Facility, AvailabilitySlot, WeekdayHours } from '../../../shared/types';

export function isFacilityUnavailableOnDate(facility: Facility, date: string): boolean {
  const weekday = new Date(date + 'T00:00:00').getDay();
  return facility.closedWeekdays.includes(weekday) || facility.maintenanceDates.includes(date);
}

/**
 * 指定日の曜日に対応する営業時間を返す。
 * weekdayHours に対象曜日の設定があればそれを使い、なければ施設のデフォルトを返す。
 */
export function getHoursForDate(
  facility: Facility,
  date: string,
): { openHour: number; closeHour: number; slotDurationMinutes: number } {
  const weekday = new Date(date + 'T00:00:00').getDay();
  const override: WeekdayHours | undefined = (facility.weekdayHours ?? []).find(
    (wh) => wh.weekday === weekday,
  );
  return {
    openHour: override?.openHour ?? facility.openHour,
    closeHour: override?.closeHour ?? facility.closeHour,
    slotDurationMinutes: override?.slotDurationMinutes ?? facility.slotDurationMinutes,
  };
}

/**
 * 施設の営業時間をスロット配列に展開する
 * 各スロットの available / currentCount は呼び出し元が埋める
 */
export function generateSlots(facility: Facility, date: string): Omit<AvailabilitySlot, 'available' | 'currentCount'>[] {
  const slots: Omit<AvailabilitySlot, 'available' | 'currentCount'>[] = [];

  if (isFacilityUnavailableOnDate(facility, date)) return [];

  const { openHour, closeHour, slotDurationMinutes } = getHoursForDate(facility, date);

  const totalMinutes = (closeHour - openHour) * 60;
  const slotCount = Math.floor(totalMinutes / slotDurationMinutes);

  for (let i = 0; i < slotCount; i++) {
    const startMin = openHour * 60 + i * slotDurationMinutes;
    const endMin = startMin + slotDurationMinutes;
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

  const { openHour, closeHour, slotDurationMinutes } = getHoursForDate(facility, date);
  const startMin = hhmmToMinutes(startTime);
  const endMin = startMin + slotDurationMinutes;
  const openMin  = openHour  * 60;
  const closeMin = closeHour * 60;
  return startMin >= openMin && endMin <= closeMin;
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
