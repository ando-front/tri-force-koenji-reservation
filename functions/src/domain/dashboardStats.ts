import type {
  DashboardStats,
  DashboardFacilityCount,
  Facility,
  Reservation,
} from '../../../shared/types';

const TOP_MEMBERS_LIMIT = 5;
const ANON_NAME = '（未入力）';

/** JST基準の "YYYY-MM-DD" を返す */
export function todayJst(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/** "YYYY-MM-DD" の日付を days 日ずらした文字列を返す */
export function shiftDateString(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** ダッシュボード用の集計範囲: 過去30日〜翌7日 */
export interface DashboardWindows {
  today: string;
  last30From: string;
  last30To: string;
  upcomingFrom: string;
  upcomingTo: string;
  queryFrom: string;
  queryTo: string;
}

export function buildDashboardWindows(now: Date = new Date()): DashboardWindows {
  const today = todayJst(now);
  const last30From   = shiftDateString(today, -30);
  const last30To     = today;
  const upcomingFrom = today;
  const upcomingTo   = shiftDateString(today, 7);
  return {
    today,
    last30From,
    last30To,
    upcomingFrom,
    upcomingTo,
    queryFrom: last30From,
    queryTo:   upcomingTo,
  };
}

/**
 * 予約一覧と施設マスタからダッシュボード統計を算出する純関数。
 * I/Oを含まないためユニットテスト可能。
 */
export function buildDashboardStats(
  reservations: Reservation[],
  facilities: Facility[],
  now: Date = new Date()
): DashboardStats {
  const win = buildDashboardWindows(now);
  const facilityNameById = new Map<string, string>();
  for (const f of facilities) facilityNameById.set(f.facilityId, f.name);

  // 今日のステータス別件数
  const todayCounts = { pending: 0, confirmed: 0, cancelled: 0 };
  // 今後7日 施設別
  const upcomingByFacility = new Map<string, number>();
  // 直近30日
  let last30Total = 0;
  let last30Cancelled = 0;
  // 直近30日 会員別
  const memberCounts = new Map<string, number>();

  for (const r of reservations) {
    const isActive = r.status === 'pending' || r.status === 'confirmed';

    if (r.date === win.today) {
      if (r.status === 'pending')   todayCounts.pending   += 1;
      if (r.status === 'confirmed') todayCounts.confirmed += 1;
      if (r.status === 'cancelled') todayCounts.cancelled += 1;
    }

    if (r.date >= win.upcomingFrom && r.date <= win.upcomingTo && isActive) {
      upcomingByFacility.set(r.facilityId, (upcomingByFacility.get(r.facilityId) ?? 0) + 1);
    }

    if (r.date >= win.last30From && r.date <= win.last30To) {
      last30Total += 1;
      if (r.status === 'cancelled') last30Cancelled += 1;

      if (isActive) {
        const name = r.memberName?.trim() ? r.memberName.trim() : ANON_NAME;
        memberCounts.set(name, (memberCounts.get(name) ?? 0) + 1);
      }
    }
  }

  const byFacility: DashboardFacilityCount[] = Array.from(upcomingByFacility.entries())
    .map(([facilityId, count]) => ({
      facilityId,
      facilityName: facilityNameById.get(facilityId) ?? facilityId,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topMembers = Array.from(memberCounts.entries())
    .sort(([aName, aCount], [bName, bCount]) => bCount - aCount || aName.localeCompare(bName, 'ja'))
    .slice(0, TOP_MEMBERS_LIMIT)
    .map(([memberName, count]) => ({ memberName, count }));

  const upcomingTotal = byFacility.reduce((sum, f) => sum + f.count, 0);

  return {
    generatedAt: now.toISOString(),
    today: {
      date:      win.today,
      pending:   todayCounts.pending,
      confirmed: todayCounts.confirmed,
      cancelled: todayCounts.cancelled,
      total:     todayCounts.pending + todayCounts.confirmed,
    },
    upcomingWeek: {
      dateFrom: win.upcomingFrom,
      dateTo:   win.upcomingTo,
      total:    upcomingTotal,
      byFacility,
    },
    last30Days: {
      dateFrom: win.last30From,
      dateTo:   win.last30To,
      total:    last30Total,
      cancelled: last30Cancelled,
      cancellationRate: last30Total === 0 ? 0 : last30Cancelled / last30Total,
    },
    topMembers,
  };
}
