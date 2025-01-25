const {
  parseStartTime,
  calculateEndTime,
  isSameHour,
  convertSpreadsheetDate,
  isTimeSlotFull,
  createCalendarEvent,
  createTextOutput,
} = require('../code'); // テスト対象のファイルをrequire

// モックの設定
global.SpreadsheetApp = {
  openById: jest.fn(() => ({
    getSpreadsheetTimeZone: jest.fn(() => 'Asia/Tokyo'),
    getSpreadsheetLocale: jest.fn(() => 'ja_JP'),
    getSheetByName: jest.fn(() => ({
      getLastRow: jest.fn(() => 2), // テスト用に2行に設定
      getRange: jest.fn(() => ({
        getValue: jest.fn(() => new Date('2024-01-01T10:00:00.000Z')), // テストデータ
      })),
    })),
  })),
};

global.CalendarApp = {
  getCalendarById: jest.fn(() => ({
    createEvent: jest.fn(() => ({ getId: jest.fn(() => 'testEventId') })),
  })),
};

global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn(() => 'testCalendarId'),
  })),
};

global.Logger = {
  log: jest.fn(),
};

global.Utilities = {
  formatDate: jest.fn((date, timeZone, format) => {
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }),
};

global.ContentService = {
  createTextOutput: jest.fn(() => ({
    setMimeType: jest.fn(() => ({
      TEXT: 'text/plain',
    })),
  })),
  MimeType: {
    TEXT: 'text/plain',
  },
};

describe('code functions', () => {
  it('parseStartTime 正しい日付文字列からDateオブジェクトを生成', () => {
    const date = parseStartTime('2024/01/01 10:00:00');
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // 月は0から始まる
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });
  it('parseStartTime 不正な日付文字列でエラーをthrow', () => {
    expect(() => parseStartTime('不正な日付')).toThrow(
      '日付の形式が正しくありません。'
    );
  });

  it('calculateEndTime 開始時刻から終了時刻を正しく計算', () => {
    const startTime = new Date('2024-01-01T10:00:00.000Z');
    const endTime = calculateEndTime(startTime);
    expect(endTime).toBeInstanceOf(Date);
    expect(endTime.getTime()).toBe(startTime.getTime() + 60 * 60 * 1000);
  });

  it('isSameHour 同じ時間かどうかを正しく判定', () => {
    const date1 = new Date('2024-01-01T10:00:00.000Z');
    const date2 = new Date('2024-01-01T10:30:00.000Z');
    const date3 = new Date('2024-01-02T10:00:00.000Z');
    expect(isSameHour(date1, date2)).toBe(true);
    expect(isSameHour(date1, date3)).toBe(false);
  });

  it('convertSpreadsheetDate 数値からDateオブジェクトに変換', () => {
    const date = convertSpreadsheetDate(44927, 'ja_JP'); // 2023/01/01
    expect(date).toBeInstanceOf(Date);
  });

  it('convertSpreadsheetDate Dateオブジェクトがそのまま返る', () => {
    const date = new Date();
    expect(convertSpreadsheetDate(date, 'ja_JP')).toBe(date);
  });
  it('convertSpreadsheetDate 文字列からDateオブジェクトに変換', () => {
    const date = convertSpreadsheetDate('2024-01-01 10:00:00', 'ja_JP');
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });
  it('convertSpreadsheetDate 不正な文字列でnullを返す', () => {
    expect(convertSpreadsheetDate('不正な文字列', 'ja_JP')).toBeNull();
  });

  it('isTimeSlotFull 時間帯が満員かどうかを判定', () => {
    expect(isTimeSlotFull(new Date())).toBe(false); // モックでは常にfalse
  });

  it('createCalendarEvent カレンダーイベントを作成', () => {
    const formData = { 氏名: 'テスト', 予約施設: 'テスト施設', 備考: '備考' };
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const result = createCalendarEvent(formData, startTime, endTime);
    expect(result.message).toBe('予約が完了しました。');
    expect(result.status).toBe('ok');
    expect(result.eventId).toBe('testEventId');
  });
  it('createTextOutput テキスト出力を生成', () => {
    const text = 'テストテキスト';
    const result = createTextOutput(text);
    expect(ContentService.createTextOutput).toHaveBeenCalledWith(text);
    expect(result.setMimeType).toHaveBeenCalledWith(
      ContentService.MimeType.TEXT
    );
  });
});
