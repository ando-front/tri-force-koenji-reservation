import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { adminGetDashboardStats } from '@/lib/api';
import type { DashboardStats } from '@/types';

function StatCard({
  label,
  value,
  accent,
  sublabel,
}: {
  label: string;
  value: string | number;
  accent?: 'brand' | 'green' | 'yellow' | 'red' | 'gray';
  sublabel?: string;
}) {
  const color = {
    brand:  'text-brand-600',
    green:  'text-green-600',
    yellow: 'text-yellow-600',
    red:    'text-red-600',
    gray:   'text-gray-600',
  }[accent ?? 'gray'];

  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-gray-400">{sublabel}</p>}
    </div>
  );
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max === 0 ? 0 : (count / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{count}件</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn:  adminGetDashboardStats,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">ダッシュボード</h1>
            <Link to="/admin" className="text-sm text-brand-600 hover:underline">
              予約管理
            </Link>
            <Link to="/admin/facilities" className="text-sm text-brand-600 hover:underline">
              施設管理
            </Link>
            <Link to="/admin/manual" className="text-sm text-brand-600 hover:underline">
              操作マニュアル
            </Link>
          </div>
          <button onClick={() => signOut(auth)} className="btn-secondary text-xs">
            ログアウト
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {data ? `最終更新: ${new Date(data.generatedAt).toLocaleString('ja-JP')}` : '—'}
          </p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary text-xs"
          >
            {isFetching ? '更新中…' : '再読み込み'}
          </button>
        </div>

        {isLoading && (
          <div className="card text-center text-sm text-gray-500">読み込み中…</div>
        )}
        {isError && (
          <div className="card text-center text-sm text-red-600">
            取得に失敗しました: {(error as Error)?.message}
          </div>
        )}

        {data && (
          <>
            {/* 本日の予約 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">
                本日の予約（{data.today.date}）
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="有効予約件数"
                  value={data.today.total}
                  accent="brand"
                  sublabel="仮受付 + 確定"
                />
                <StatCard label="仮受付" value={data.today.pending} accent="yellow" />
                <StatCard label="確定"   value={data.today.confirmed} accent="green" />
                <StatCard label="キャンセル" value={data.today.cancelled} accent="gray" />
              </div>
            </section>

            {/* 今後7日の施設別 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">
                今後7日の予約（{data.upcomingWeek.dateFrom} 〜 {data.upcomingWeek.dateTo}）
              </h2>
              <div className="card space-y-4">
                <p className="text-sm text-gray-500">
                  合計 <span className="font-bold text-gray-900">{data.upcomingWeek.total}</span>件
                </p>
                {data.upcomingWeek.byFacility.length === 0 ? (
                  <p className="text-sm text-gray-400">該当する予約がありません</p>
                ) : (
                  <div className="space-y-3">
                    {data.upcomingWeek.byFacility.map((f) => (
                      <BarRow
                        key={f.facilityId}
                        label={f.facilityName}
                        count={f.count}
                        max={data.upcomingWeek.byFacility[0]?.count ?? 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 直近30日の実績 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">
                直近30日の実績（{data.last30Days.dateFrom} 〜 {data.last30Days.dateTo}）
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="総予約件数（全ステータス）" value={data.last30Days.total} />
                <StatCard label="キャンセル件数" value={data.last30Days.cancelled} accent="gray" />
                <StatCard
                  label="キャンセル率"
                  value={formatPercent(data.last30Days.cancellationRate)}
                  accent={data.last30Days.cancellationRate > 0.2 ? 'red' : 'brand'}
                />
              </div>
            </section>

            {/* 利用頻度トップ */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">
                直近30日の利用頻度トップ
              </h2>
              <div className="card p-0 overflow-hidden">
                {data.topMembers.length === 0 ? (
                  <p className="p-6 text-center text-sm text-gray-400">データがありません</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.topMembers.map((m, idx) => (
                      <li key={`${m.memberName}-${idx}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-gray-800">{m.memberName}</span>
                        <span className="font-mono text-gray-500">{m.count}件</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
