import { toAvailabilitySlots, todayJst } from '@tfk/core';
import { getFacilityWithSchedule, getOccupancyForDate, listFacilitiesPublic } from '@tfk/db';
import Link from 'next/link';
import { getAppDb } from '@/lib/db';

export const dynamic = 'force-dynamic'; // 空き状況は常に最新を返す（RSC が直接 DB を読む — 設計書 8.1）

export default async function TopPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string; date?: string }>;
}) {
  const params = await searchParams;
  const db = getAppDb();
  const facilities = await listFacilitiesPublic(db);

  const facilityId = params.facilityId ?? facilities[0]?.id;
  const date = params.date ?? todayJst();

  const facility = facilityId ? await getFacilityWithSchedule(db, facilityId) : null;

  let slots: ReturnType<typeof toAvailabilitySlots> = [];
  if (facility) {
    const dayStart = new Date(`${date}T00:00:00+09:00`);
    const dayEnd = new Date(`${date}T00:00:00+09:00`);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const occupancy = await getOccupancyForDate(db, facility.id, dayStart, dayEnd);
    slots = toAvailabilitySlots(facility, date, occupancy);
  }

  return (
    <main>
      <h1>トライフォース高円寺 空き状況・予約</h1>

      <div className="card">
        <form
          method="get"
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}
        >
          <div className="field">
            <label htmlFor="facilityId">施設</label>
            <select id="facilityId" name="facilityId" defaultValue={facilityId}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="date">日付</label>
            <input id="date" name="date" type="date" defaultValue={date} min={todayJst()} />
          </div>
          <button className="btn" type="submit">
            表示
          </button>
        </form>
      </div>

      <div className="card">
        <h2>{facility?.name ?? '施設が見つかりません'}</h2>
        <p style={{ color: '#64748b' }}>
          {date} の空き状況（{slots.filter((s) => s.available).length} / {slots.length}{' '}
          枠が予約可能）
        </p>
        <div className="slot-grid">
          {slots.map((s) => (
            <Link
              key={s.startTime}
              href={
                s.available && facility
                  ? `/facilities/${facility.id}/reserve?date=${date}&startTime=${s.startTime}`
                  : '#'
              }
              className="slot"
              data-available={s.available}
              aria-disabled={!s.available}
              style={{
                pointerEvents: s.available ? 'auto' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div>{s.startTime}</div>
              <div style={{ fontSize: 12 }}>
                {s.currentCount}/{s.capacity}名
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p>
        <Link href="/my-reservation">予約の確認・キャンセルはこちら</Link>
      </p>
    </main>
  );
}
