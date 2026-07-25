import { describe, expect, it } from 'vitest';
import {
  calcEndTime,
  generateSlotTemplates,
  isFacilityUnavailableOnDate,
  isWithinOperatingHours,
  toAvailabilitySlots,
} from './availability';
import type { Facility } from './schema';

const baseFacility: Facility = {
  id: 'test-facility',
  name: 'テスト施設',
  capacity: 10,
  openHour: 9,
  closeHour: 21,
  slotDurationMinutes: 60,
  closedWeekdays: [0], // 日曜定休
  maintenanceDates: ['2026-03-24'],
  isActive: true,
  weekdayHours: [],
  blockedPeriods: [],
};

describe('generateSlotTemplates（旧 generateSlots の移植）', () => {
  it('09:00〜21:00 を60分刻みで12スロット生成する', () => {
    const slots = generateSlotTemplates(baseFacility, '2026-03-23'); // 月曜日
    expect(slots).toHaveLength(12);
    expect(slots[0]?.startTime).toBe('09:00');
    expect(slots[0]?.endTime).toBe('10:00');
    expect(slots[11]?.startTime).toBe('20:00');
  });

  it('定休日（日曜日）は空配列を返す', () => {
    expect(generateSlotTemplates(baseFacility, '2026-03-22')).toHaveLength(0); // 日曜
  });

  it('メンテナンス日は空配列を返す', () => {
    expect(generateSlotTemplates(baseFacility, '2026-03-24')).toHaveLength(0);
  });

  it('isFacilityUnavailableOnDate は定休日・メンテ日で true', () => {
    expect(isFacilityUnavailableOnDate(baseFacility, '2026-03-22')).toBe(true);
    expect(isFacilityUnavailableOnDate(baseFacility, '2026-03-23')).toBe(false);
  });
});

describe('isWithinOperatingHours / calcEndTime', () => {
  it('営業時間内は true', () => {
    expect(isWithinOperatingHours(baseFacility, '2026-03-23', '09:00')).toBe(true);
  });
  it('営業時間外は false', () => {
    expect(isWithinOperatingHours(baseFacility, '2026-03-23', '21:00')).toBe(false);
  });
  it('60分後の終了時刻を計算する（跨日を含む）', () => {
    expect(calcEndTime('09:00', 60)).toBe('10:00');
    expect(calcEndTime('23:30', 60)).toBe('00:30');
  });
});

// B-3 の CI 必須ケース: JST 18:00 時点で 17:00 の枠が予約不可であること
describe('toAvailabilitySlots（占有数 + 過去判定を統合、B-3 の根治を確認）', () => {
  it('JST 18:00 時点で 17:00 の枠は available=false になる', () => {
    const now = new Date('2026-03-23T09:00:00.000Z'); // JST 18:00
    const slots = toAvailabilitySlots(baseFacility, '2026-03-23', new Map(), now);
    const slot17 = slots.find((s) => s.startTime === '17:00');
    const slot19 = slots.find((s) => s.startTime === '19:00');
    expect(slot17?.available).toBe(false);
    expect(slot19?.available).toBe(true);
  });

  it('定員に達したスロットは available=false になる', () => {
    const now = new Date('2026-03-23T00:00:00.000Z'); // JST 09:00（全枠が未来）
    const occ = new Map<string, number>();
    const slots = toAvailabilitySlots(baseFacility, '2026-03-23', occ, now);
    const first = slots[0]!;
    occ.set(first.startsAt.toISOString(), first.capacity); // 定員ちょうど埋める
    const refilled = toAvailabilitySlots(baseFacility, '2026-03-23', occ, now);
    expect(refilled[0]?.available).toBe(false);
  });
});
