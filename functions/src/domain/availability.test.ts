import { generateSlots, isWithinOperatingHours, calcEndTime, getHoursForDate } from '../domain/availability';
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

  it('曜日別設定がある場合はその時間帯でスロットを生成する', () => {
    // 月曜日(1)に12:00〜18:00のカスタム設定
    const facility: Facility = {
      ...baseFacility,
      weekdayHours: [{ weekday: 1, openHour: 12, closeHour: 18 }],
    };
    const slots = generateSlots(facility, '2026-03-23'); // 月曜日
    expect(slots).toHaveLength(6);
    expect(slots[0].startTime).toBe('12:00');
    expect(slots[5].endTime).toBe('18:00');
  });

  it('曜日別設定で枠時間も上書きできる', () => {
    // 土曜日(6)に10:00〜14:00、30分枠
    const facility: Facility = {
      ...baseFacility,
      weekdayHours: [{ weekday: 6, openHour: 10, closeHour: 14, slotDurationMinutes: 30 }],
    };
    const slots = generateSlots(facility, '2026-03-28'); // 土曜日
    expect(slots).toHaveLength(8); // 4時間 / 30分 = 8スロット
  });

  it('曜日別設定がない曜日はデフォルトを使用する', () => {
    const facility: Facility = {
      ...baseFacility,
      weekdayHours: [{ weekday: 1, openHour: 12, closeHour: 18 }], // 月曜のみカスタム
    };
    // メンテ日でない火曜日（2026-03-31）はデフォルトの9:00〜21:00, 60分枠を使用する
    const slotsTue = generateSlots(facility, '2026-03-31'); // 火曜日
    expect(slotsTue).toHaveLength(12); // デフォルト9:00〜21:00, 60分枠
    expect(slotsTue[0].startTime).toBe('09:00');
    expect(slotsTue[11].endTime).toBe('21:00');
  });

  it('全体 blockedPeriods が設定されていたらそのスロットを除外する', () => {
    // 9:00〜21:00 60分枠で、12:00〜14:00 をブロック → 10スロット
    const facility: Facility = {
      ...baseFacility,
      blockedPeriods: [{ startTime: '12:00', endTime: '14:00' }],
    };
    const slots = generateSlots(facility, '2026-03-23'); // 月曜日
    expect(slots).toHaveLength(10);
    expect(slots.find((s) => s.startTime === '12:00')).toBeUndefined();
    expect(slots.find((s) => s.startTime === '13:00')).toBeUndefined();
    expect(slots.find((s) => s.startTime === '11:00')).toBeDefined();
    expect(slots.find((s) => s.startTime === '14:00')).toBeDefined();
  });

  it('曜日別 blockedPeriods が全体設定を上書きする', () => {
    // 全体は 12:00〜14:00 ブロック、月曜は 10:00〜11:00 のみブロック
    const facility: Facility = {
      ...baseFacility,
      blockedPeriods: [{ startTime: '12:00', endTime: '14:00' }],
      weekdayHours: [{
        weekday: 1, openHour: 9, closeHour: 21,
        blockedPeriods: [{ startTime: '10:00', endTime: '11:00' }],
      }],
    };
    const slots = generateSlots(facility, '2026-03-23'); // 月曜日
    // 9:00〜21:00 60分枠 12スロット、10:00〜11:00 ブロック → 11スロット
    expect(slots).toHaveLength(11);
    expect(slots.find((s) => s.startTime === '10:00')).toBeUndefined();
    expect(slots.find((s) => s.startTime === '12:00')).toBeDefined(); // 全体設定は上書き済み
  });

  it('weekdays スコープ付き blockedPeriods は指定曜日のみ有効', () => {
    // 月曜(1)のみ 12:00〜14:00 をブロック
    const facility: Facility = {
      ...baseFacility,
      blockedPeriods: [{ startTime: '12:00', endTime: '14:00', weekdays: [1] }],
    };
    const slotsMonday = generateSlots(facility, '2026-03-23'); // 月曜
    expect(slotsMonday).toHaveLength(10); // 12スロット - 2 = 10
    expect(slotsMonday.find((s) => s.startTime === '12:00')).toBeUndefined();

    const slotsTuesday = generateSlots(facility, '2026-03-31'); // 火曜（別週）
    expect(slotsTuesday).toHaveLength(12); // 月曜限定なので火曜は全スロット
    expect(slotsTuesday.find((s) => s.startTime === '12:00')).toBeDefined();
  });

  it('dates スコープ付き blockedPeriods は指定日のみ有効', () => {
    // 2026-03-23 のみ 12:00〜14:00 をブロック
    const facility: Facility = {
      ...baseFacility,
      blockedPeriods: [{ startTime: '12:00', endTime: '14:00', dates: ['2026-03-23'] }],
    };
    const slotsOnDate = generateSlots(facility, '2026-03-23'); // 指定日
    expect(slotsOnDate).toHaveLength(10); // ブロック適用

    const slotsOtherDate = generateSlots(facility, '2026-03-25'); // 別の日（水曜）
    expect(slotsOtherDate).toHaveLength(12); // ブロック非適用
    expect(slotsOtherDate.find((s) => s.startTime === '12:00')).toBeDefined();
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

  it('曜日別設定がある場合はその時間でチェックする', () => {
    const facility: Facility = {
      ...baseFacility,
      weekdayHours: [{ weekday: 1, openHour: 12, closeHour: 18 }],
    };
    expect(isWithinOperatingHours(facility, '2026-03-23', '12:00')).toBe(true);
    expect(isWithinOperatingHours(facility, '2026-03-23', '09:00')).toBe(false); // デフォルト開始前
    expect(isWithinOperatingHours(facility, '2026-03-23', '17:00')).toBe(true);
    expect(isWithinOperatingHours(facility, '2026-03-23', '18:00')).toBe(false); // 終了時刻はNG
  });

  it('blockedPeriods に含まれる時刻は false を返す', () => {
    const facility: Facility = {
      ...baseFacility,
      blockedPeriods: [{ startTime: '12:00', endTime: '14:00' }],
    };
    expect(isWithinOperatingHours(facility, '2026-03-23', '12:00')).toBe(false);
    expect(isWithinOperatingHours(facility, '2026-03-23', '13:00')).toBe(false);
    expect(isWithinOperatingHours(facility, '2026-03-23', '11:00')).toBe(true);
    expect(isWithinOperatingHours(facility, '2026-03-23', '14:00')).toBe(true);
  });
});

describe('getHoursForDate', () => {
  it('weekdayHours がない場合はデフォルトを返す', () => {
    const hours = getHoursForDate(baseFacility, '2026-03-23');
    expect(hours.openHour).toBe(9);
    expect(hours.closeHour).toBe(21);
    expect(hours.slotDurationMinutes).toBe(60);
  });

  it('対象曜日の設定がある場合はそれを返す', () => {
    const facility: Facility = {
      ...baseFacility,
      weekdayHours: [{ weekday: 1, openHour: 12, closeHour: 18, slotDurationMinutes: 30 }],
    };
    const hours = getHoursForDate(facility, '2026-03-23'); // 月曜日
    expect(hours.openHour).toBe(12);
    expect(hours.closeHour).toBe(18);
    expect(hours.slotDurationMinutes).toBe(30);
  });

  it('対象曜日の枠時間が省略された場合はデフォルトを使う', () => {
    const facility: Facility = {
      ...baseFacility,
      weekdayHours: [{ weekday: 1, openHour: 12, closeHour: 18 }],
    };
    const hours = getHoursForDate(facility, '2026-03-23');
    expect(hours.slotDurationMinutes).toBe(60); // デフォルト
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
