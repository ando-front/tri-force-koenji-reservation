import { generateSlots, isWithinOperatingHours, calcEndTime } from '../domain/availability';
import { Facility } from '../../../shared/types';

const baseFacility: Facility = {
  facilityId:          'test-facility',
  name:                'テスト施設',
  capacity:            10,
  openHour:            9,
  closeHour:           21,
  slotDurationMinutes: 60,
  closedWeekdays:      [0], // 日曜定休
  maintenanceDates:    ['2026-03-24'],
  isActive:            true,
  createdAt:           null,
  updatedAt:           null,
};

describe('generateSlots', () => {
  it('09:00〜21:00 を60分刻みで12スロット生成する', () => {
    const slots = generateSlots(baseFacility, '2026-03-23'); // 月曜日
    expect(slots).toHaveLength(12);
    expect(slots[0].startTime).toBe('09:00');
    expect(slots[0].endTime).toBe('10:00');
    expect(slots[11].startTime).toBe('20:00');
    expect(slots[11].endTime).toBe('21:00');
  });

  it('定休日（日曜日）は空配列を返す', () => {
    const slots = generateSlots(baseFacility, '2026-03-22'); // 日曜
    expect(slots).toHaveLength(0);
  });

  it('メンテナンス日は空配列を返す', () => {
    const slots = generateSlots(baseFacility, '2026-03-24');
    expect(slots).toHaveLength(0);
  });
});

describe('isWithinOperatingHours', () => {
  it('営業時間内なら true を返す', () => {
    expect(isWithinOperatingHours(baseFacility, '2026-03-23', '09:00')).toBe(true);
    expect(isWithinOperatingHours(baseFacility, '2026-03-23', '20:00')).toBe(true);
  });

  it('営業時間外なら false を返す', () => {
    expect(isWithinOperatingHours(baseFacility, '2026-03-23', '21:00')).toBe(false); // 終了時刻ぴったりはNG
    expect(isWithinOperatingHours(baseFacility, '2026-03-23', '08:00')).toBe(false);
  });

  it('定休日なら false を返す', () => {
    expect(isWithinOperatingHours(baseFacility, '2026-03-22', '10:00')).toBe(false);
  });

  it('メンテナンス日なら false を返す', () => {
    expect(isWithinOperatingHours(baseFacility, '2026-03-24', '10:00')).toBe(false);
  });
});

describe('calcEndTime', () => {
  it('09:00 + 60分 = 10:00', () => {
    expect(calcEndTime('09:00', 60)).toBe('10:00');
  });

  it('20:00 + 60分 = 21:00', () => {
    expect(calcEndTime('20:00', 60)).toBe('21:00');
  });

  it('23:30 + 60分 = 00:30 (跨日)', () => {
    expect(calcEndTime('23:30', 60)).toBe('00:30');
  });
});
