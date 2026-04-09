import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchReservationForCancel, cancelReservation } from '@/lib/api';

export function CancelPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const token = searchParams.get('token') ?? '';
  const [cancelled, setCancelled] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cancel-reservation', id, token],
    queryFn: () => fetchReservationForCancel(id, token),
    enabled: Boolean(id && token),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => cancelReservation(id, token),
    onSuccess: () => setCancelled(true),
  });

  if (!id || !token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-red-600 font-bold mb-4">無効なリンクです</p>
          <Link to="/" className="btn-primary inline-block">トップページへ</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-red-600 font-bold mb-2">予約が見つかりませんでした</p>
          <p className="text-gray-500 text-sm mb-4">リンクが無効か、予約が既に削除されています。</p>
          <Link to="/" className="btn-primary inline-block">トップページへ</Link>
        </div>
      </div>
    );
  }

  const r = data.reservation;

  // キャンセル完了画面
  if (cancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-green-600 text-5xl mb-4">&#10003;</div>
          <h1 className="text-xl font-bold mb-2">キャンセルが完了しました</h1>
          <p className="text-gray-600 mb-6">
            予約番号 <span className="font-mono font-bold">{r.reservationId.slice(0, 8).toUpperCase()}</span> のキャンセルが完了しました。
          </p>
          <Link to="/" className="btn-primary inline-block">新しい予約をする</Link>
        </div>
      </div>
    );
  }

  // 既にキャンセル済み
  if (r.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-yellow-600 font-bold mb-2">この予約は既にキャンセルされています</p>
          <Link to="/" className="btn-primary inline-block">トップページへ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <h1 className="text-xl font-bold mb-4 text-center">予約キャンセル</h1>

        <p className="text-gray-600 text-sm mb-4">以下の予約をキャンセルしますか？</p>

        <dl className="space-y-2 text-sm mb-6">
          <div className="flex">
            <dt className="w-24 font-bold text-gray-600">予約番号</dt>
            <dd className="font-mono">{r.reservationId.slice(0, 8).toUpperCase()}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 font-bold text-gray-600">施設名</dt>
            <dd>{r.facilityName}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 font-bold text-gray-600">利用日</dt>
            <dd>{r.date}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 font-bold text-gray-600">時間</dt>
            <dd>{r.startTime} 〜 {r.endTime}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 font-bold text-gray-600">参加人数</dt>
            <dd>{r.participants}名</dd>
          </div>
          {r.memberName && (
            <div className="flex">
              <dt className="w-24 font-bold text-gray-600">予約者名</dt>
              <dd>{r.memberName}</dd>
            </div>
          )}
        </dl>

        {mutation.error && (
          <p className="text-red-600 text-sm mb-4">
            {(mutation.error as Error).message || 'キャンセルに失敗しました'}
          </p>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="btn-danger w-full"
          >
            この予約をキャンセルする
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-red-600 text-sm font-bold text-center">本当にキャンセルしますか？この操作は取り消せません。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="btn-secondary flex-1"
                disabled={mutation.isPending}
              >
                戻る
              </button>
              <button
                onClick={() => mutation.mutate()}
                className="btn-danger flex-1"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'キャンセル中...' : 'キャンセル確定'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-brand-600 hover:underline">トップページへ戻る</Link>
        </div>
      </div>
    </div>
  );
}
