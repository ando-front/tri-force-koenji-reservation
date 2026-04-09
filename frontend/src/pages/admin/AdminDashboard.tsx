import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { adminGetDashboardStats } from '@/lib/api';
import type { Reservation } from '@/types';

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

function StatCard({ title, stats }: {
  title: string;
  stats: { total: number; pending: number; confirmed: number; cancelled: number };
}) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-500 mb-3">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-3">{stats.total}<span className="text-base font-normal text-gray-500 ml-1">件</span></p>
      <div className="flex gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          仮受付 {stats.pending}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          確定 {stats.confirmed}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-400" />
          取消 {stats.cancelled}
        </span>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn:  adminGetDashboardStats,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">ダッシュボード</h1>
            <Link to="/admin/reservations" className="text-sm text-brand-600 hover:underline">予約管理</Link>
            <Link to="/admin/facilities" className="text-sm text-brand-600 hover:underline">施設管理</Link>
            <Link to="/admin/manual" className="text-sm text-brand-600 hover:underline">マニュアル</Link>
          </div>
          <button onClick={() => signOut(auth)} className="btn-secondary text-xs">
            ログアウト
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {isLoading && <p className="text-center text-gray-500">読み込み中...</p>}
        {isError && <p className="text-center text-red-600">統計データの取得に失敗しました</p>}

        {data && (
          <>
            {/* 統計カード */}
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="本日の予約" stats={data.today} />
              <StatCard title="今週の予約" stats={data.week} />
              <StatCard title="今月の予約" stats={data.month} />
            </div>

            {/* 直近の予約一覧 */}
            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h2 className="font-semibold text-gray-900">直近の予約</h2>
                <Link to="/admin/reservations" className="text-sm text-brand-600 hover:underline">
                  すべて表示
                </Link>
              </div>

              {data.recent.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">予約がありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['ID', '施設名', 'ユーザー', '日時', 'ステータス'].map((h) => (
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
                      {data.recent.map((r: Reservation) => (
                        <tr key={r.reservationId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">
                            <Link to={`/admin/reservations/${r.reservationId}`} className="text-brand-600 hover:underline">
                              {r.reservationId.slice(0, 8).toUpperCase()}
                            </Link>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{r.facilityName}</td>
                          <td className="px-4 py-3">{r.memberName || '(未記入)'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{r.date} {r.startTime}〜{r.endTime}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABEL[r.status] ?? r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
