import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { adminListAuditLogs } from '@/lib/api';
import type { AuditAction, AuditLog, ListAuditLogsQuery } from '@/types';

const ACTION_LABEL: Record<AuditAction, string> = {
  'reservation.created':   '予約作成',
  'reservation.confirmed': '予約確定',
  'reservation.cancelled': '予約キャンセル',
  'reservation.deleted':   '予約削除',
  'content.updated':       'サイト文言更新',
};

const ACTION_COLOR: Record<AuditAction, string> = {
  'reservation.created':   'bg-blue-100   text-blue-800',
  'reservation.confirmed': 'bg-green-100  text-green-800',
  'reservation.cancelled': 'bg-yellow-100 text-yellow-800',
  'reservation.deleted':   'bg-red-100    text-red-800',
  'content.updated':       'bg-purple-100 text-purple-800',
};

const ACTOR_LABEL: Record<string, string> = {
  system: 'システム',
  member: '会員',
};

function formatTimestamp(value: unknown): string {
  if (!value) return '—';
  // Firestore Timestamp は { _seconds, _nanoseconds } 形式でJSONシリアライズされる
  const seconds = (value as { _seconds?: number; seconds?: number })._seconds
    ?? (value as { seconds?: number }).seconds;
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000).toLocaleString('ja-JP');
  }
  return String(value);
}

function actorLabel(actor: string): string {
  return ACTOR_LABEL[actor] ?? `管理者 (${actor.slice(0, 8)})`;
}

function PayloadCell({ payload }: { payload: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  if (!payload || Object.keys(payload).length === 0) {
    return <span className="text-gray-300">—</span>;
  }
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-brand-600 hover:underline"
      >
        {expanded ? '閉じる' : '表示'}
      </button>
      {expanded && (
        <pre className="mt-1 max-w-md overflow-auto rounded bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">
{JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AdminAuditLogPage() {
  const [filter, setFilter] = useState<ListAuditLogsQuery>({
    action:   undefined,
    actor:    undefined,
    targetId: undefined,
    limit:    50,
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['admin', 'audit-logs', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => adminListAuditLogs({ ...filter, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const allLogs: AuditLog[] = data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">監査ログ</h1>
            <Link to="/admin"           className="text-sm text-brand-600 hover:underline">予約管理</Link>
            <Link to="/admin/dashboard" className="text-sm text-brand-600 hover:underline">ダッシュボード</Link>
            <Link to="/admin/facilities" className="text-sm text-brand-600 hover:underline">施設管理</Link>
          </div>
          <button onClick={() => signOut(auth)} className="btn-secondary text-xs">
            ログアウト
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {/* フィルター */}
        <div className="card flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="action" className="form-label">操作種別</label>
            <select
              id="action"
              value={filter.action ?? ''}
              onChange={(e) =>
                setFilter((f) => ({ ...f, action: (e.target.value || undefined) as AuditAction | undefined }))
              }
              className="form-input w-auto"
            >
              <option value="">全種別</option>
              <option value="reservation.created">予約作成</option>
              <option value="reservation.confirmed">予約確定</option>
              <option value="reservation.cancelled">予約キャンセル</option>
              <option value="reservation.deleted">予約削除</option>
            </select>
          </div>
          <div>
            <label htmlFor="actor" className="form-label">アクター（system/member/管理者UID）</label>
            <input
              id="actor"
              type="text"
              value={filter.actor ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, actor: e.target.value || undefined }))}
              className="form-input w-auto"
              placeholder="例: system, member"
            />
          </div>
          <div>
            <label htmlFor="targetId" className="form-label">対象ID（予約ID）</label>
            <input
              id="targetId"
              type="text"
              value={filter.targetId ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, targetId: e.target.value || undefined }))}
              className="form-input w-auto font-mono"
              placeholder="reservationId"
            />
          </div>
        </div>

        {/* 一覧 */}
        <div className="card overflow-hidden p-0">
          {isLoading && (
            <p className="p-6 text-center text-sm text-gray-500">読み込み中…</p>
          )}
          {isError && (
            <p className="p-6 text-center text-sm text-red-600">
              取得に失敗しました: {(error as Error)?.message}
            </p>
          )}
          {!isLoading && !isError && allLogs.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-500">該当するログがありません</p>
          )}

          {allLogs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['日時', 'アクター', '操作', '対象', 'ペイロード'].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {allLogs.map((log) => (
                    <tr key={log.logId} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {actorLabel(log.actor)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {ACTION_LABEL[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {log.action.startsWith('reservation.') && log.action !== 'reservation.deleted' ? (
                          <Link
                            to={`/admin/reservations/${log.targetId}`}
                            className="text-brand-600 hover:underline"
                          >
                            {log.targetId.slice(0, 8).toUpperCase()}
                          </Link>
                        ) : log.action === 'content.updated' ? (
                          <span className="text-gray-600">{log.targetId}</span>
                        ) : (
                          <span className="text-gray-400">{log.targetId.slice(0, 8).toUpperCase()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <PayloadCell payload={log.payload as Record<string, unknown>} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
