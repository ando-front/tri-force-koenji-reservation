import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminGetReservation,
  adminUpdateReservationStatus,
  adminDeleteReservation,
} from '@/lib/api';
import { formatReservationDisplayName } from '@/lib/reservationDisplay';

const STATUS_LABEL: Record<string, string> = {
  pending:   '仮受付',
  confirmed: '確定',
  cancelled: 'キャンセル',
};
const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100  text-green-800',
  cancelled: 'bg-gray-100   text-gray-600',
};

export function AdminReservationDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const { data: reservation, isLoading, isError } = useQuery({
    queryKey: ['admin', 'reservation', id],
    queryFn:  () => adminGetReservation(id!),
    enabled:  Boolean(id),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      adminUpdateReservationStatus(id!, { status: 'confirmed' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reservation', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      adminUpdateReservationStatus(id!, { status: 'cancelled', cancelReason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reservation', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'reservations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminDeleteReservation(id!),
    onSuccess:  () => navigate('/admin'),
  });

  function handleCancel() {
    const reason = window.prompt('キャンセル理由（任意）') ?? '';
    cancelMutation.mutate(reason);
  }

  function handleDelete() {
    if (!window.confirm('この予約を完全に削除しますか？')) return;
    deleteMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">読み込み中…</p>
      </div>
    );
  }

  if (isError || !reservation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600">予約の取得に失敗しました</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/admin" className="text-sm text-brand-600 hover:underline">
            ← 一覧に戻る
          </Link>
          <Link to="/admin/manual" className="text-sm text-brand-600 hover:underline">
            操作マニュアル
          </Link>
          <h1 className="text-lg font-bold text-gray-900">予約詳細</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="card space-y-6">
          {/* ステータス */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                STATUS_COLOR[reservation.status] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {STATUS_LABEL[reservation.status] ?? reservation.status}
            </span>
            <span className="font-mono text-xs text-gray-400">
              #{reservation.reservationId.slice(0, 8).toUpperCase()}
            </span>
          </div>

          {/* 詳細 */}
          <dl className="divide-y divide-gray-100 text-sm">
            {[
              ['表示名',         formatReservationDisplayName(reservation.memberName)],
              ['メールアドレス', reservation.email],
              ['日付',           reservation.date],
              ['時間',           `${reservation.startTime} 〜 ${reservation.endTime}`],
              ['人数',           `${reservation.participants}名`],
              ['施設ID',         reservation.facilityId],
              ['利用目的',       reservation.purpose],
              ['備考',           reservation.remarks ?? '—'],
              ['キャンセル理由', reservation.cancelReason ?? '—'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex gap-4 py-3">
                <dt className="w-32 shrink-0 text-gray-500">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>

          {/* アクション */}
          <div className="flex flex-wrap gap-3 pt-2">
            {reservation.status === 'pending' && (
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="btn-primary"
              >
                {confirmMutation.isPending ? '処理中…' : '予約を確定する'}
              </button>
            )}
            {reservation.status !== 'cancelled' && (
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="btn-secondary"
              >
                {cancelMutation.isPending ? '処理中…' : 'キャンセルする'}
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn-danger ml-auto"
            >
              {deleteMutation.isPending ? '削除中…' : '削除する'}
            </button>
          </div>

          {/* エラー表示 */}
          {(confirmMutation.isError || cancelMutation.isError || deleteMutation.isError) && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {(confirmMutation.error ?? cancelMutation.error ?? deleteMutation.error)?.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
