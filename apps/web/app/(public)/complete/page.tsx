import { reservations } from '@tfk/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getAppDb } from '@/lib/db';

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const db = getAppDb();
  const reservation = id
    ? await db.query.reservations.findFirst({ where: eq(reservations.id, id) })
    : null;

  return (
    <main>
      <h1>予約が完了しました</h1>
      {reservation ? (
        <div className="card">
          <p>
            予約番号: <strong>{reservation.id.slice(0, 8).toUpperCase()}</strong>
          </p>
          <p>参加人数: {reservation.participants}名</p>
          <p>ステータス: {reservation.status}</p>
        </div>
      ) : (
        <p>予約情報が見つかりませんでした。</p>
      )}
      <p>
        <Link href="/my-reservation">予約の確認・キャンセルはこちら</Link>
      </p>
    </main>
  );
}
