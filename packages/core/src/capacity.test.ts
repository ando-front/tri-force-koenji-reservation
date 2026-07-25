import { describe, expect, it } from 'vitest';
import { sumParticipants, wouldExceedCapacity } from './capacity';

// B-1 の CI 必須ケース（設計書 8.3）:
// 「定員10名の枠に5名×3件を投げて3件目が拒否されること」
describe('capacity.ts（B-1 の根治: 人数ベースの定員判定）', () => {
  it('定員10名の枠に5名を3件投げると、3件目のみ拒否される', () => {
    const capacity = 10;
    const accepted: number[] = [];
    for (const participants of [5, 5, 5]) {
      const existing = sumParticipants(accepted.map((p) => ({ participants: p })));
      if (!wouldExceedCapacity(existing, participants, capacity)) {
        accepted.push(participants);
      }
    }
    expect(accepted).toEqual([5, 5]);
  });

  it('件数は少ないが人数が多い予約も正しく弾く（旧・件数ベース判定の欠陥を再発させない）', () => {
    // 旧実装は「予約件数 >= capacity」で判定していたため、1件で定員を超える
    // 大人数予約が2件通ってしまうケースを検出できなかった。
    const capacity = 10;
    expect(wouldExceedCapacity(0, 8, capacity)).toBe(false); // 1件目 8名 OK
    expect(wouldExceedCapacity(8, 8, capacity)).toBe(true); // 2件目 8名 → 合計16名で拒否
  });
});
