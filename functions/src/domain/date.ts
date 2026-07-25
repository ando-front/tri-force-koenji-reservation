/** JST基準の "YYYY-MM-DD" を返す。Cloud Functions のタイムゾーンに依存しない。 */
export function todayJst(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/**
 * JST の壁時計における「0:00 からの分数」を返す。
 *
 * B-3: `now.getHours()` は Cloud Functions のランタイム TZ（UTC）に依存するため、
 * JST 09:00〜18:00 の間、過去枠判定が最大 9 時間ずれるバグの原因になっていた。
 * JST への変換は必ずこの関数（または {@link todayJst}）経由で行うこと。
 */
export function nowJstMinutes(now: Date = new Date()): number {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes();
}

/** "YYYY-MM-DD" の日付を days 日ずらした文字列を返す */
export function shiftDateString(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}
