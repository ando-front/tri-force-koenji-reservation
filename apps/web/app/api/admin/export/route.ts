import { listReservationsAdmin } from '@tfk/db';
import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getAppDb } from '@/lib/db';

/**
 * GET /api/admin/export — CSV エクスポート（B-2 の構造的な解決）。
 *
 * 旧実装は Express の `router.get('/admin/:id', ...)` が `router.get('/admin/export', ...)`
 * より先に定義されていたため、`/admin/export` が `id="export"` として吸収され
 * 常に 404 を返していた。Next.js のファイルシステムルーティングでは
 * `/api/admin/export/route.ts` と `/api/admin/[id]/route.ts` が同じ階層に
 * 共存でき、定義順という概念自体が存在しないため、この種のバグはそもそも起こり得ない。
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) {
    return Response.json({ success: false, error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  }

  const facilityId = request.nextUrl.searchParams.get('facilityId') ?? undefined;
  const db = getAppDb();
  const reservations = await listReservationsAdmin(db, { facilityId, limit: 5000 });

  const BOM = '﻿';
  const header =
    '予約番号,会員名,メールアドレス,施設ID,開始時刻,終了時刻,参加人数,利用目的,備考,ステータス,登録日時\n';
  const rows = reservations.map((r) =>
    [
      r.id.slice(0, 8).toUpperCase(),
      r.memberName,
      r.email,
      r.facilityId,
      r.startsAt.toISOString(),
      r.endsAt.toISOString(),
      r.participants,
      `"${r.purpose.replace(/"/g, '""')}"`,
      `"${(r.remarks ?? '').replace(/"/g, '""')}"`,
      r.status,
      r.createdAt.toISOString(),
    ].join(','),
  );

  const csv = BOM + header + rows.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reservations_${Date.now()}.csv"`,
    },
  });
}
