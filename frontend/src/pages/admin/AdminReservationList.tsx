import { useState, useCallback } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  adminListReservations,
  adminUpdateReservationStatus,
  adminDeleteReservation,
  fetchFacilities,
} from '@/lib/api';
import type { Reservation, Facility, ListReservationsQuery } from '@/types';

// ---- ステータス表示ヘルパー --------------------------------------------------
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

// ---- コンポーネント ---------------------------------------------------------
export function AdminReservationList() {
  const qc = useQueryClient();

  const [filter, setFilter] = useState<ListReservationsQuery>({
    facilityId: undefined,
    dateFrom:   undefined,
    dateTo:     undefined,
    status:     undefined,
    limit:      20,
  });

  // 施設一覧（フィルター用）
  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn:  fetchFacilities,
  });

  // 予約一覧（無限スクロール）
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey:       ['admin', 'reservations', filter],
    initialPageParam: undefined as string | undefined,
    queryFn:        ({ pageParam }) =>
      adminListReservations({ ...filter, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const allReservations: Reservation[] =
    data?.pages.flatMap((p) => p.reservations) ?? [];

  // ステータス更新
  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      adminUpdateReservationStatus(id, { status: 'confirmed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reservations'] }),
  });
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminUpdateReservationStatus(id, { status: 'cancelled', cancelReason: reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reservations'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteReservation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reservations'] }),
  });

  // CSV エクスポート
  async function handleExport() {
    const user  = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const params = new URLSearchParams();
    if (filter.facilityId) params.set('facilityId', filter.facilityId);
    if (filter.dateFrom)   params.set('dateFrom',   filter.dateFrom);
    if (filter.dateTo)     params.set('dateTo',     filter.dateTo);
    if (filter.status)     params.set('status',     filter.status);
    // Authorization ヘッダーを付けて fetch してダウンロード
    const BASE_URL = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string) ?? '';
    const res = await fetch(`${BASE_URL}/reservations/admin/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { alert('エクスポートに失敗しました'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reservations_${filter.dateFrom ?? 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleCancel = useCallback((id: string) => {
    const reason = window.prompt('キャンセル理由を入力してください（任意）') ?? '';
    cancelMutation.mutate({ id, reason });
  }, [cancelMutation]);

  const handleDelete = useCallback((id: string) => {
    if (!window.confirm('この予約を完全に削除しますか？')) return;
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">予約管理</h1>
            <Link to="/admin/facilities" className="text-sm text-brand-600 hover:underline">
              施設管理へ
            </Link>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="btn-secondary text-xs"
          >
            ログアウト
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* フィルター */}
        <div className="card flex flex-wrap gap-3">
          {/* 施設 */}
          <select
            value={filter.facilityId ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, facilityId: e.target.value || undefined, cursor: undefined }))
            }
            className="form-input w-auto"
          >
            <option value="">全施設</option>
            {facilities?.map((fc: Facility) => (
              <option key={fc.facilityId} value={fc.facilityId}>
                {fc.name}
              </option>
            ))}
          </select>

          {/* 日付 */}
          <input
            type="date"
            value={filter.dateFrom ?? ''}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                dateFrom: e.target.value || undefined,
                dateTo: e.target.value || undefined,
                cursor: undefined,
              }))
            }
            className="form-input w-auto"
          />

          {/* ステータス */}
          <select
            value={filter.status ?? ''}
            onChange={(e) =>
              setFilter((f) => ({ ...f, status: (e.target.value as ListReservationsQuery['status']) || undefined, cursor: undefined }))
            }
            className="form-input w-auto"
          >
            <option value="">全ステータス</option>
            <option value="pending">仮受付</option>
            <option value="confirmed">確定</option>
            <option value="cancelled">キャンセル</option>
          </select>

          <button onClick={handleExport} className="btn-secondary ml-auto text-sm">
            CSVエクスポート
          </button>
        </div>

        {/* 一覧テーブル */}
        <div className="card overflow-hidden p-0">
          {isLoading && (
            <p className="p-6 text-center text-sm text-gray-500">読み込み中…</p>
          )}
          {isError && (
            <p className="p-6 text-center text-sm text-red-600">取得に失敗しました</p>
          )}
          {!isLoading && allReservations.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-500">予約がありません</p>
          )}

          {allReservations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['ID', '氏名', '日付', '時間', '人数', 'ステータス', '操作'].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {allReservations.map((r) => (
                    <tr key={r.reservationId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {r.reservationId.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/reservations/${r.reservationId}`}
                          className="text-brand-600 hover:underline"
                        >
                          {r.memberName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.startTime}〜{r.endTime}
                      </td>
                      <td className="px-4 py-3 text-right">{r.participants}名</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => confirmMutation.mutate(r.reservationId)}
                              className="btn-primary py-1 px-2 text-xs"
                            >
                              確定
                            </button>
                          )}
                          {r.status !== 'cancelled' && (
                            <button
                              onClick={() => handleCancel(r.reservationId)}
                              className="btn-secondary py-1 px-2 text-xs"
                            >
                              ｷｬﾝｾﾙ
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(r.reservationId)}
                            className="btn-danger py-1 px-2 text-xs"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* もっと読み込む */}
          {hasNextPage && (
            <div className="p-4 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="btn-secondary"
              >
                {isFetchingNextPage ? '読み込み中…' : 'さらに表示'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
