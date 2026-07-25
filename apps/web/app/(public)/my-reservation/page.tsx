import { listReservationsByEmail } from '@tfk/db';
import { getAppDb } from '@/lib/db';
import { CancelButton } from './cancel-button';

export default async function MyReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const db = getAppDb();
  const reservations = email ? await listReservationsByEmail(db, email) : [];

  return (
    <main>
      <h1>予約の確認・キャンセル</h1>
      <div className="card">
        <form method="get">
          <div className="field">
            <label htmlFor="email">メールアドレス</label>
            <input id="email" name="email" type="email" defaultValue={email} required />
          </div>
          <button className="btn" type="submit">
            照会する
          </button>
        </form>
      </div>

      {email && (
        <div className="card">
          {reservations.length === 0 ? (
            <p>予約が見つかりませんでした。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>予約番号</th>
                  <th>開始</th>
                  <th>人数</th>
                  <th>状態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id.slice(0, 8).toUpperCase()}</td>
                    <td>{r.startsAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                    <td>{r.participants}名</td>
                    <td>{r.status}</td>
                    <td>
                      {r.status !== 'cancelled' && (
                        <CancelButton reservationId={r.id} email={email} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
