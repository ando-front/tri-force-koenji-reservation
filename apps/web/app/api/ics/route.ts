import { buildMyReservationUrl, buildReservationIcal } from '@tfk/core';
import { facilities, reservations } from '@tfk/db';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getAppDb } from '@/lib/db';

/** GET /api/ics?id=&email= — 会員向け iCal ダウンロード */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const email = request.nextUrl.searchParams.get('email');
  if (!id || !email) return new Response('missing id/email', { status: 400 });

  const db = getAppDb();
  const reservation = await db.query.reservations.findFirst({ where: eq(reservations.id, id) });
  if (!reservation || reservation.email !== email.trim().toLowerCase()) {
    return new Response('not found', { status: 404 });
  }
  const facility = await db.query.facilities.findFirst({
    where: eq(facilities.id, reservation.facilityId),
  });

  const ics = buildReservationIcal(
    {
      id: reservation.id,
      facilityName: facility?.name ?? reservation.facilityId,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      participants: reservation.participants,
      purpose: reservation.purpose,
      status: reservation.status,
    },
    {
      myReservationUrl: buildMyReservationUrl(
        reservation.id.slice(0, 8).toUpperCase(),
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    },
  );

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="reservation_${id.slice(0, 8)}.ics"`,
    },
  });
}
