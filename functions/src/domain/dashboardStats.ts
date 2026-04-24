import type {
  DashboardStats,
  DashboardFacilityCount,
  Facility,
  Reservation,
} from '../../../shared/types';
import { todayJst, shiftDateString } from './date';

const TOP_MEMBERS_LIMIT = 5;
const ANON_NAME = '（未入力）';

/**
 * ダッシュボード用の集計範囲。
 * すべて inclusive で扱う:
 *  - 直近30日: today を含む過去30日間 (today-29 〜 today)
 *  - 今後7日:  today を含む7日間   (today 〜 today+6)
 */
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
  const last30From   = shiftDateString(today, -29); // inclusive で30日分
  const last30To     = today;
  const upcomingFrom = today;
  const upcomingTo   = shiftDateString(today, 6);   // inclusive で7日分
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
  // 今後7日 施設別（予約側のデノーマライズ名をフォールバックとして保持）
  const upcomingByFacility = new Map<string, { count: number; fallbackName: string }>();
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
      const prev = upcomingByFacility.get(r.facilityId);
      upcomingByFacility.set(r.facilityId, {
        count: (prev?.count ?? 0) + 1,
        fallbackName: prev?.fallbackName || r.facilityName || '',
      });
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
    .map(([facilityId, { count, fallbackName }]) => ({
      facilityId,
      // 施設マスタ > 予約側のデノーマライズ名 > ID の順でフォールバックする
      facilityName: facilityNameById.get(facilityId) || fallbackName || facilityId,
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
