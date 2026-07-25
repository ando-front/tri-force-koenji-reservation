import { listFacilitiesAdmin } from '@tfk/db';
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/auth';
import { getAppDb } from '@/lib/db';
import { CreateFacilityForm } from './create-facility-form';

export default async function AdminFacilitiesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect('/admin/login');

  const db = getAppDb();
  const facilities = await listFacilitiesAdmin(db);

  return (
    <main>
      <h1>施設管理</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>定員</th>
              <th>営業時間</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{f.name}</td>
                <td>{f.capacity}名</td>
                <td>
                  {f.openHour}:00〜{f.closeHour}:00
                </td>
                <td>{f.isActive ? '有効' : '無効'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>施設を追加</h2>
        <CreateFacilityForm />
      </div>
    </main>
  );
}
