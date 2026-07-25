import { todayJst, nowJstMinutes } from './date';

// B-3 回帰テスト: 「JST 18:00 時点で 17:00 の枠が予約不可であること」（設計書 8.3 の CI 必須ケース）。
// 現行の不具合は `now.getHours()` / `toISOString().split('T')[0]` が
// Cloud Functions の実行環境 TZ（UTC）に依存していたことが原因だった。
describe('nowJstMinutes / todayJst（B-3: JST 判定の一元化）', () => {
  it('UTC 09:00（= JST 18:00）を JST の 18:00 として計算する', () => {
    const now = new Date('2026-07-25T09:00:00.000Z');
    expect(nowJstMinutes(now)).toBe(18 * 60);
    // 17:00 の枠は 17:00 <= 18:00 なので「過去」判定になるべき
    const slotMin = 17 * 60;
    expect(slotMin <= nowJstMinutes(now)).toBe(true);
  });

  it('UTC 15:30（= JST 翌 00:30）は日付が UTC とは異なる', () => {
    // UTC ではまだ 7/25 だが JST ではすでに 7/26 に日付が進んでいる。
    // 旧実装（toISOString().split('T')[0]）はここで前日の日付を返し、
    // 「日付が変わった直後の過去枠」を誤って予約可能と判定してしまっていた。
    const now = new Date('2026-07-25T15:30:00.000Z');
    expect(todayJst(now)).toBe('2026-07-26');
    expect(nowJstMinutes(now)).toBe(0 * 60 + 30);
  });

  it('UTC 00:00（= JST 09:00、営業開始時刻）は境界を跨がない通常ケース', () => {
    const now = new Date('2026-07-25T00:00:00.000Z');
    expect(todayJst(now)).toBe('2026-07-25');
    expect(nowJstMinutes(now)).toBe(9 * 60);
  });
});
