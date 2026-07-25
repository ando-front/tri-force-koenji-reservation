import { desc } from 'drizzle-orm';
import type { getDb } from '../client';
import { reservationEvents } from '../schema';

export async function listAuditLogs(db: ReturnType<typeof getDb>, limit = 50) {
  // 旧実装はフィルタ×orderBy の複合インデックス回避のため app 側で等価フィルタを行い、
  // 最悪ケースで 5,000 件を走査していた。Postgres では複合インデックス
  // (action, actor, occurred_at) を張れば単純に 1 クエリで済む。
  return db.query.reservationEvents.findMany({
    orderBy: desc(reservationEvents.occurredAt),
    limit: Math.min(limit, 500),
  });
}
