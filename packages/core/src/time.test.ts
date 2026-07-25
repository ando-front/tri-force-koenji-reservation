import { describe, expect, it } from 'vitest';
import { isSlotPast, nowJstMinutes, todayJst } from './time';

// B-3 の CI 必須ケース（設計書 8.3）:「JST 18:00 時点で 17:00 の枠が予約不可であること」
describe('time.ts（B-3 の根治）', () => {
  it('UTC 09:00（JST 18:00）を正しく18:00として計算する', () => {
    const now = new Date('2026-07-25T09:00:00.000Z');
    expect(nowJstMinutes(now)).toBe(18 * 60);
  });

  it('日付が変わる境界（UTC 15:00 = JST 翌0:00）でも todayJst が正しい日付を返す', () => {
    const now = new Date('2026-07-25T15:00:00.000Z');
    expect(todayJst(now)).toBe('2026-07-26');
  });

  it('isSlotPast: timestamptz の単純比較になり、壁時計の分計算が不要', () => {
    const now = new Date('2026-07-25T09:00:00.000Z'); // JST 18:00
    const slot17 = new Date('2026-07-25T08:00:00.000Z'); // JST 17:00
    const slot19 = new Date('2026-07-25T10:00:00.000Z'); // JST 19:00
    expect(isSlotPast(slot17, now)).toBe(true);
    expect(isSlotPast(slot19, now)).toBe(false);
  });
});
