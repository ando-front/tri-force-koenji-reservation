import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchUsageGuideContent } from '@/lib/api';
import { DEFAULT_USAGE_GUIDE_CONTENT } from '@/types';

export function UsageGuidePage() {
  // 取得失敗時もデフォルト文言で表示できるよう、retry/staleTime を緩めに設定
  const { data } = useQuery({
    queryKey: ['content', 'usage-guide'],
    queryFn:  fetchUsageGuideContent,
    staleTime: 60_000,
    retry: 1,
  });

  const reservationSteps = data?.reservationSteps?.length
    ? data.reservationSteps
    : DEFAULT_USAGE_GUIDE_CONTENT.reservationSteps;
  const notes = data?.notes ?? DEFAULT_USAGE_GUIDE_CONTENT.notes;

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
                <li key={`${index}-${step}`} className="flex gap-3">
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
            <h2 className="text-lg font-semibold text-gray-900">予約の確認・キャンセル</h2>
            <p className="mt-4 text-sm leading-7 text-gray-700">
              予約完了時に発行される8桁の予約番号と、予約時に入力したメールアドレスを
              <Link to="/my-reservation" className="mx-1 font-medium text-brand-600 underline underline-offset-2">
                予約確認ページ
              </Link>
              に入力すると、予約内容の確認と利用日当日までのキャンセルが行えます。
              過去日の予約を変更したい場合は、運営までご連絡ください。
            </p>
          </section>

          {notes.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-semibold text-gray-900">留意事項</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
                {notes.map((note, index) => (
                  <li key={`${index}-${note}`} className="rounded-md bg-gray-50 px-4 py-3">
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          )}

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
