import { randomUUID } from 'node:crypto';
import { getFacilityWithSchedule } from '@tfk/db';
import { notFound } from 'next/navigation';
import { getAppDb } from '@/lib/db';
import { ReservationForm } from './reservation-form';

export default async function ReservePage({
  params,
  searchParams,
}: {
  params: Promise<{ facilityId: string }>;
  searchParams: Promise<{ date?: string; startTime?: string }>;
}) {
  const { facilityId } = await params;
  const sp = await searchParams;
  const db = getAppDb();
  const facility = await getFacilityWithSchedule(db, facilityId);
  if (!facility) notFound();

  // idempotencyKey はページ表示（サーバ側レンダリング）ごとに 1 つ発行し hidden field に
  // 埋め込む。連打・戻る+再送信でも同じキーが飛ぶため、二重送信は DB 制約で弾かれる（B-5）。
  const idempotencyKey = randomUUID();

  return (
    <main>
      <h1>{facility.name} の予約</h1>
      <div className="card">
        <ReservationForm
          facilityId={facility.id}
          date={sp.date ?? ''}
          startTime={sp.startTime ?? ''}
          idempotencyKey={idempotencyKey}
        />
      </div>
    </main>
  );
}
