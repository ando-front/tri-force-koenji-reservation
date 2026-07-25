import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/auth';

export default async function AdminDashboardPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect('/admin/login');

  return (
    <main>
      <h1>管理ダッシュボード</h1>
      <p>ログイン中: {admin.email}</p>
      <div className="card">
        <ul>
          <li>
            <Link href="/admin/reservations">予約一覧・CSVエクスポート</Link>
          </li>
          <li>
            <Link href="/admin/facilities">施設管理</Link>
          </li>
          <li>
            <Link href="/admin/audit-logs">監査ログ</Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
