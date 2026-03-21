import { Link } from 'react-router-dom';

const reservationSteps = [
  '施設と日付を選択し、空き時間帯を確認します。',
  '表示されている予約者名を確認し、希望枠を選択します。',
  'ニックネーム（任意）、メールアドレス、参加人数、利用目的を入力して送信します。',
  '受付完了後、確認メールが届きます。',
];

const notes = [
  '各時間帯には入力したニックネームを公開表示します。未入力の場合は「会員1」形式の表示名になります。',
  'メンテナンス日と定休日は予約できません。空き枠が表示されない日は別日を選択してください。',
  '利用人数は実際の参加予定人数を入力してください。',
  '予約内容の確認や調整が必要な場合は、運営から連絡することがあります。',
];

export function UsageGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        <header className="mb-8">
          <Link to="/" className="text-sm text-brand-600 hover:underline">
            ← 予約ページへ戻る
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">利用案内・留意事項</h1>
          <p className="mt-2 text-sm text-gray-600">
            予約前に、予約の流れと公開情報の扱いを確認してください。
          </p>
        </header>

        <div className="space-y-6">
          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">予約の流れ</h2>
            <ol className="mt-4 space-y-3 text-sm text-gray-700">
              {reservationSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">公開される情報</h2>
            <p className="mt-4 text-sm leading-7 text-gray-700">
              予約状況の一覧では、各時間帯に入力されたニックネームを表示します。未入力時は「会員1」形式の表示名を使い、メールアドレスや備考などの詳細情報は公開しません。
            </p>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">留意事項</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
              {notes.map((note) => (
                <li key={note} className="rounded-md bg-gray-50 px-4 py-3">
                  {note}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-gray-900">管理者運用メモ</h2>
            <p className="mt-4 text-sm leading-7 text-gray-700">
              管理者は施設管理画面からメンテナンス日を追加できます。登録した日付は公開予約画面に即時反映され、該当日は予約不可になります。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
