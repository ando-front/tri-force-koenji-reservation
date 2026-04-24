/** JST基準の "YYYY-MM-DD" を返す。Cloud Functions のタイムゾーンに依存しない。 */
export function todayJst(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/** "YYYY-MM-DD" の日付を days 日ずらした文字列を返す */
export function shiftDateString(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}
