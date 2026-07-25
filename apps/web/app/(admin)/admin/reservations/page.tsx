import { listReservationsAdmin } from '@tfk/db';
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/auth';
import { getAppDb } from '@/lib/db';

/**
 * 管理者向け予約一覧。フィルタは searchParams が状態になる（設計書 8.1: TanStack Query
 * から URL 状態への置き換え）。CSV エクスポートは `/api/admin/export`
 * （Route Handler、ファイルシステムルーティングなので B-2 のような衝突は起きない）。
 */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect('/admin/login');

  const { facilityId } = await searchParams;
  const db = getAppDb();
  const reservations = await listReservationsAdmin(db, { facilityId, limit: 200 });

  const exportHref = `/api/admin/export${facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ''}`;

  return (
    <main>
      <h1>予約一覧</h1>
      <p>
        <a className="btn" href={exportHref}>
          CSV エクスポート
        </a>
      </p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>予約番号</th>
              <th>施設</th>
              <th>開始</th>
              <th>氏名</th>
              <th>人数</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id}>
                <td>{r.id.slice(0, 8).toUpperCase()}</td>
                <td>{r.facilityId}</td>
                <td>{r.startsAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                <td>{r.memberName}</td>
                <td>{r.participants}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
