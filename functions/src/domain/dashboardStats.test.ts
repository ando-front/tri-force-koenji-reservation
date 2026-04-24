import { buildDashboardStats, buildDashboardWindows } from './dashboardStats';
import { shiftDateString, todayJst } from './date';
import type { Facility, Reservation } from '../../../shared/types';

function makeReservation(overrides: Partial<Reservation>): Reservation {
  return {
    reservationId: 'r-' + Math.random().toString(36).slice(2, 10),
    memberName: 'テスト太郎',
    email: 'test@example.com',
    facilityId: 'free-mat',
    facilityName: 'フリーマット',
    date: '2026-04-10',
    startTime: '10:00',
    endTime: '11:00',
    purpose: '練習',
    participants: 1,
    remarks: '',
    status: 'pending',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const facilities: Facility[] = [
  {
    facilityId: 'free-mat',
    name: 'フリーマット',
    capacity: 5,
    openHour: 9,
    closeHour: 22,
    slotDurationMinutes: 60,
    closedWeekdays: [],
    maintenanceDates: [],
    isActive: true,
    createdAt: null,
    updatedAt: null,
  },
  {
    facilityId: 'fitness',
    name: 'フィットネス',
    capacity: 3,
    openHour: 9,
    closeHour: 22,
    slotDurationMinutes: 60,
    closedWeekdays: [],
    maintenanceDates: [],
    isActive: true,
    createdAt: null,
    updatedAt: null,
  },
];

describe('todayJst', () => {
  it('UTC 2026-04-10T18:00:00Z は JST で 2026-04-11', () => {
    expect(todayJst(new Date('2026-04-10T18:00:00Z'))).toBe('2026-04-11');
  });
});

describe('shiftDateString', () => {
  it('月をまたぐ日付計算が正しい', () => {
    expect(shiftDateString('2026-04-01', -1)).toBe('2026-03-31');
    expect(shiftDateString('2026-04-30', 1)).toBe('2026-05-01');
  });
});

describe('buildDashboardWindows', () => {
  it('今日を含む過去30日と今日を含む今後7日のレンジを返す（inclusive）', () => {
    const now = new Date('2026-04-10T03:00:00Z'); // JST 12:00
    const win = buildDashboardWindows(now);
    expect(win.today).toBe('2026-04-10');
    // today-29 〜 today の inclusive で30日分
    expect(win.last30From).toBe('2026-03-12');
    expect(win.last30To).toBe('2026-04-10');
    // today 〜 today+6 の inclusive で7日分
    expect(win.upcomingFrom).toBe('2026-04-10');
    expect(win.upcomingTo).toBe('2026-04-16');
    expect(win.queryFrom).toBe('2026-03-12');
    expect(win.queryTo).toBe('2026-04-16');
  });
});

describe('buildDashboardStats', () => {
  const now = new Date('2026-04-10T03:00:00Z'); // JST = 2026-04-10 12:00

  it('今日の予約をステータス別に集計し、キャンセルは total から除外する', () => {
    const reservations = [
      makeReservation({ date: '2026-04-10', status: 'pending' }),
      makeReservation({ date: '2026-04-10', status: 'confirmed' }),
      makeReservation({ date: '2026-04-10', status: 'confirmed' }),
      makeReservation({ date: '2026-04-10', status: 'cancelled' }),
    ];
    const stats = buildDashboardStats(reservations, facilities, now);
    expect(stats.today).toEqual({
      date: '2026-04-10',
      pending: 1,
      confirmed: 2,
      cancelled: 1,
      total: 3,
    });
  });

  it('今後7日は施設別にアクティブな予約のみ数え、降順にソートする', () => {
    const reservations = [
      makeReservation({ date: '2026-04-10', facilityId: 'free-mat',  status: 'confirmed' }),
      makeReservation({ date: '2026-04-11', facilityId: 'free-mat',  status: 'pending' }),
      makeReservation({ date: '2026-04-12', facilityId: 'fitness',   status: 'confirmed' }),
      makeReservation({ date: '2026-04-12', facilityId: 'free-mat',  status: 'cancelled' }), // 除外
      makeReservation({ date: '2026-04-17', facilityId: 'free-mat',  status: 'confirmed' }), // 範囲外 (today+7)
    ];
    const stats = buildDashboardStats(reservations, facilities, now);
    expect(stats.upcomingWeek.dateFrom).toBe('2026-04-10');
    expect(stats.upcomingWeek.dateTo).toBe('2026-04-16');
    expect(stats.upcomingWeek.total).toBe(3);
    expect(stats.upcomingWeek.byFacility).toEqual([
      { facilityId: 'free-mat', facilityName: 'フリーマット', count: 2 },
      { facilityId: 'fitness',  facilityName: 'フィットネス', count: 1 },
    ]);
  });

  it('直近30日のキャンセル率を計算する', () => {
    const reservations = [
      makeReservation({ date: '2026-04-01', status: 'confirmed' }),
      makeReservation({ date: '2026-04-05', status: 'confirmed' }),
      makeReservation({ date: '2026-04-06', status: 'cancelled' }),
      makeReservation({ date: '2026-04-09', status: 'cancelled' }),
      makeReservation({ date: '2026-02-01', status: 'confirmed' }), // 範囲外
    ];
    const stats = buildDashboardStats(reservations, facilities, now);
    expect(stats.last30Days.total).toBe(4);
    expect(stats.last30Days.cancelled).toBe(2);
    expect(stats.last30Days.cancellationRate).toBeCloseTo(0.5);
  });

  it('直近30日のアクティブ予約から上位5名の会員を降順で返し、未入力は「（未入力）」として集計', () => {
    const reservations = [
      makeReservation({ date: '2026-04-01', status: 'confirmed', memberName: 'Aさん' }),
      makeReservation({ date: '2026-04-02', status: 'confirmed', memberName: 'Aさん' }),
      makeReservation({ date: '2026-04-03', status: 'confirmed', memberName: 'Bさん' }),
      makeReservation({ date: '2026-04-04', status: 'confirmed', memberName: '' }),
      makeReservation({ date: '2026-04-05', status: 'pending',   memberName: '' }),
      makeReservation({ date: '2026-04-06', status: 'cancelled', memberName: 'Aさん' }), // カウント対象外
    ];
    const stats = buildDashboardStats(reservations, facilities, now);
    expect(stats.topMembers).toHaveLength(3);
    // Aさん と 未入力 はともに2件でタイなので上位2つに並ぶ（順序は collation 依存）
    const top2Names = stats.topMembers.slice(0, 2).map((m) => m.memberName).sort();
    expect(top2Names).toEqual(['Aさん', '（未入力）'].sort());
    expect(stats.topMembers.slice(0, 2).every((m) => m.count === 2)).toBe(true);
    expect(stats.topMembers[2]).toEqual({ memberName: 'Bさん', count: 1 });
  });

  it('予約がゼロでも安全な値を返す（キャンセル率0）', () => {
    const stats = buildDashboardStats([], facilities, now);
    expect(stats.today.total).toBe(0);
    expect(stats.upcomingWeek.total).toBe(0);
    expect(stats.upcomingWeek.byFacility).toEqual([]);
    expect(stats.last30Days.total).toBe(0);
    expect(stats.last30Days.cancellationRate).toBe(0);
    expect(stats.topMembers).toEqual([]);
  });

  it('施設マスタに無い施設は予約側のデノーマライズ名にフォールバックする', () => {
    const reservations = [
      makeReservation({ date: '2026-04-10', facilityId: 'ghost', facilityName: '存在しない施設', status: 'confirmed' }),
    ];
    const stats = buildDashboardStats(reservations, facilities, now);
    expect(stats.upcomingWeek.byFacility).toEqual([
      { facilityId: 'ghost', facilityName: '存在しない施設', count: 1 },
    ]);
  });

  it('施設マスタにも予約側 facilityName にも値が無ければ facilityId を返す', () => {
    const reservations = [
      makeReservation({ date: '2026-04-10', facilityId: 'orphan', facilityName: '', status: 'confirmed' }),
    ];
    const stats = buildDashboardStats(reservations, facilities, now);
    expect(stats.upcomingWeek.byFacility).toEqual([
      { facilityId: 'orphan', facilityName: 'orphan', count: 1 },
    ]);
  });
});
