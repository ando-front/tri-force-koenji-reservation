/**
 * 定員判定の純関数版（設計書 付録 B / B-1）。
 *
 * リアーキ後の本番経路では定員制御は Postgres の CHECK 制約
 * （`packages/db` の `slot_occupancy.within_capacity`）が最終防衛線になるため、
 * ここは「アプリ側で早期にユーザーへ分かりやすいエラーを返す」ための事前チェック
 * という位置づけ。DB 制約と同じ不変条件（人数合計 <= 定員）を表現する。
 */
export function wouldExceedCapacity(
  existingParticipants: number,
  additionalParticipants: number,
  capacity: number,
): boolean {
  return existingParticipants + additionalParticipants > capacity;
}

export function sumParticipants(reservations: ReadonlyArray<{ participants: number }>): number {
  return reservations.reduce((sum, r) => sum + (Number(r.participants) || 0), 0);
}
