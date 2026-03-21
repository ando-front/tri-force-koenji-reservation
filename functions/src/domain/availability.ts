import { Facility, AvailabilitySlot } from '../../../shared/types';

/**
 * 施設の営業時間をスロット配列に展開する
 * 各スロットの available / currentCount は呼び出し元が埋める
 */
export function generateSlots(facility: Facility, date: string): Omit<AvailabilitySlot, 'available' | 'currentCount'>[] {
  const slots: Omit<AvailabilitySlot, 'available' | 'currentCount'>[] = [];
  const { openHour, closeHour, slotDurationMinutes, closedWeekdays } = facility;

  // 定休日チェック
  const weekday = new Date(date + 'T00:00:00').getDay();
  if (closedWeekdays.includes(weekday)) return [];

  const totalMinutes = (closeHour - openHour) * 60;
  const slotCount = Math.floor(totalMinutes / slotDurationMinutes);

  for (let i = 0; i < slotCount; i++) {
    const startMin = openHour * 60 + i * slotDurationMinutes;
    const endMin = startMin + slotDurationMinutes;
    slots.push({
      startTime: minutesToHHMM(startMin),
      endTime:   minutesToHHMM(endMin),
      capacity:  facility.capacity,
    });
  }
  return slots;
}

/** HH:MM 文字列が施設の営業時間内かチェック */
export function isWithinOperatingHours(facility: Facility, date: string, startTime: string): boolean {
  const weekday = new Date(date + 'T00:00:00').getDay();
  if (facility.closedWeekdays.includes(weekday)) return false;

  const startMin = hhmmToMinutes(startTime);
  const endMin = startMin + facility.slotDurationMinutes;
  const openMin  = facility.openHour  * 60;
  const closeMin = facility.closeHour * 60;
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
