import { useLocation, Link } from 'react-router-dom';
import type { CreateReservationResponse } from '@/types';

export function CompletePage() {
  const location    = useLocation();
  const state = (location.state as { response?: CreateReservationResponse } | null) ?? null;
  const response = state?.response;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="card max-w-md w-full text-center space-y-6">
        {/* アイコン */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">予約が完了しました</h1>

        {response ? (
          <>
            <dl className="rounded-md bg-gray-50 p-4 text-left text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">予約番号</dt>
                <dd className="font-mono font-medium">{response.reservationId.slice(0, 8).toUpperCase()}</dd>
              </div>
              <p className="text-xs text-gray-500 pt-1">
                この予約番号はキャンセルや内容確認の際に必要です。必ず控えておいてください。
                番号を忘れた場合は「予約の確認・キャンセル」ページでメールアドレスからも検索できます。
              </p>
            </dl>

            <p className="text-sm text-gray-500">{response.message}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            予約完了情報を表示できませんでした。ページを再読み込みすると番号は表示されません。
            「予約の確認・キャンセル」ページで予約時のメールアドレスから本日以降の予約を一覧できます。
          </p>
        )}

        <div className="space-y-2">
          <Link
            to={response ? `/my-reservation?code=${response.reservationId.slice(0, 8).toUpperCase()}` : '/my-reservation'}
            className="btn-secondary block w-full"
          >
            予約内容を確認・キャンセルする
          </Link>
          <Link to="/" className="btn-primary block w-full">
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
