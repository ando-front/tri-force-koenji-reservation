import { listAuditLogs } from '@tfk/db';
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/auth';
import { getAppDb } from '@/lib/db';

export default async function AdminAuditLogsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect('/admin/login');

  const db = getAppDb();
  const logs = await listAuditLogs(db, 100);

  return (
    <main>
      <h1>監査ログ</h1>
      <p style={{ color: '#64748b' }}>
        B-6 の根治: 施設マスタの変更（facility.created / facility.updated）も、旧実装の console.log
        と違い、ここに必ず記録される。
      </p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>日時</th>
              <th>操作</th>
              <th>実行者</th>
              <th>対象</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.occurredAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                <td>{l.action}</td>
                <td>{l.actor}</td>
                <td>{l.targetId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
