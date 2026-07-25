/**
 * JST（Asia/Tokyo）時刻の扱いをここに集約する。
 *
 * 旧実装（Firebase 版）では「JST の今日/現在時刻」を求めるロジックが
 * 6 箇所に散らばり、そのうち UTC のままだった 4 箇所が B-3
 * （深夜帯で過去枠が予約可能に見えるバグ）の原因だった。
 *
 * 設計原則（設計書 8.2）:
 *  1. DB には timestamptz（インスタント）で保存する。文字列日付は使わない
 *  2. JST の壁時計への変換は必ずこのファイルの関数経由で行う
 *  3. 「現在時刻」は引数で受け取る（テストで固定できるようにする）
 *  4. Asia/Tokyo は DST がないため固定オフセット(+9h)で足りるが、
 *     `Intl.DateTimeFormat` を使い将来のタイムゾーン変更にも耐える実装にする
 */

export const TZ = 'Asia/Tokyo' as const;

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function jstParts(now: Date) {
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
  };
}

/** JST基準の "YYYY-MM-DD" を返す。 */
export function todayJst(now: Date = new Date()): string {
  const p = jstParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** JST の壁時計における「0:00 からの分数」（0〜1439）を返す。 */
export function nowJstMinutes(now: Date = new Date()): number {
  const p = jstParts(now);
  return Number(p.hour) * 60 + Number(p.minute);
}

/**
 * `timestamptz` として保存された枠の開始時刻が、`now` 時点で既に過去かどうかを判定する。
 *
 * timestamptz 化により、この判定は単純な instant 比較になる
 * （壁時計の分数計算が不要になり、B-3 は構造的に発生しなくなる）。
 */
export function isSlotPast(slotStartsAt: Date, now: Date = new Date()): boolean {
  return slotStartsAt.getTime() <= now.getTime();
}

/** "YYYY-MM-DD" 形式の日付文字列を days 日ずらして返す。 */
export function shiftDateString(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}
