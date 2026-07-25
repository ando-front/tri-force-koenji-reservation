/**
 * 定員判定（B-1 の根治）。
 *
 * 施設の「定員」は人数であり、予約の件数ではない。旧実装は
 * `conflictSnap.size >= capacity`（同一枠の予約ドキュメント件数）で判定していたため、
 * 例えば定員 10 名の枠でも「1 名の予約」を 10 件受け付けてしまい、実際には
 * 100 名が枠に割り当てられる、あるいは逆に「5 名の予約」が 2 件しか通らず
 * 定員 10 名のうち 8 名分を無駄にする、という 2 方向の不整合を同時に抱えていた。
 *
 * 正しい不変条件は「既存予約の参加人数合計 + 今回追加する参加人数 <= 施設定員」。
 */
export function wouldExceedCapacity(
  existingParticipants: number,
  additionalParticipants: number,
  capacity: number
): boolean {
  return existingParticipants + additionalParticipants > capacity;
}

/** 同一枠の既存予約（pending/confirmed）から参加人数の合計を求める。 */
export function sumParticipants(reservations: ReadonlyArray<{ participants: number }>): number {
  return reservations.reduce((sum, r) => sum + (Number(r.participants) || 0), 0);
}
