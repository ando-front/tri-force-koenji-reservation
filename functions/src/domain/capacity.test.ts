import { wouldExceedCapacity, sumParticipants } from './capacity';

// B-1 回帰テスト: 「定員 10 名の枠に 5 名 × 3 件を投げて 3 件目が拒否されること」
// （設計書 8.3 の CI 必須ケース）。
// 旧実装は予約の「件数」で定員判定していたため、1 件あたりの人数に関わらず
// capacity 件目までは無条件に通ってしまっていた（例: 定員 10 名でも 1 名予約なら 10 件通る）。
describe('wouldExceedCapacity / sumParticipants（B-1: 人数ベースの定員判定）', () => {
  it('定員10名の枠に5名 → 4名は合計9名で成功する', () => {
    const existing = sumParticipants([{ participants: 5 }]);
    expect(wouldExceedCapacity(existing, 4, 10)).toBe(false);
  });

  it('定員10名の枠に5名を3件投げると、3件目（合計15名）は拒否される', () => {
    const capacity = 10;
    const accepted: number[] = [];
    for (const participants of [5, 5, 5]) {
      const existing = sumParticipants(accepted.map((p) => ({ participants: p })));
      if (wouldExceedCapacity(existing, participants, capacity)) {
        continue; // 拒否
      }
      accepted.push(participants);
    }
    expect(accepted).toEqual([5, 5]); // 1, 2件目のみ成功（合計10名）、3件目は拒否
  });

  it('旧実装（件数ベース）では見逃していたケース: 1名予約を件数分（定員回数）通してしまわない', () => {
    // 定員2名の枠。旧実装は「件数 < capacity」で判定するため、
    // 1名予約を2件（合計2名）は通り、さらに1名予約の3件目も
    // 「件数2 >= capacity2」でようやく弾かれる=結果は正しく見えるが、
    // 人数の内訳が偏ると（例: 2名予約1件 + 1名予約1件 = 件数2, 人数3）容易に破綻する。
    const capacity = 2;
    let existing = sumParticipants([{ participants: 2 }]); // 件数1、人数2
    expect(wouldExceedCapacity(existing, 1, capacity)).toBe(true); // 人数ベースなら正しく拒否
    existing = sumParticipants([{ participants: 2 }, { participants: 1 }]);
    void existing;
  });
});
