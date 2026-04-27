import { processReminders } from './reminders';
import type { Reservation } from '../../../shared/types';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    reservationId: 'r-' + Math.random().toString(36).slice(2, 10),
    memberName: 'ケンジ',
    email: 'kenji@example.com',
    facilityId: 'free-mat',
    facilityName: 'フリーマット',
    date: '2026-04-12',
    startTime: '10:00',
    endTime: '11:00',
    purpose: '練習',
    participants: 1,
    remarks: '',
    status: 'confirmed',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

interface FakeDeps {
  reservations: Reservation[];
  sendResults: Map<string, boolean>;
  sentIds: string[];
  markedIds: string[];
  loggedIds: string[];
  markThrowsFor?: string;
  writeLogThrowsFor?: string;
}

function makeDeps(initial: Partial<FakeDeps> = {}) {
  const state: FakeDeps = {
    reservations: [],
    sendResults: new Map(),
    sentIds: [],
    markedIds: [],
    loggedIds: [],
    ...initial,
  };

  const deps = {
    state,
    listForDate: jest.fn(async (_date: string) => state.reservations),
    send: jest.fn(async (r: Reservation) => {
      const result = state.sendResults.get(r.reservationId) ?? true;
      if (result) state.sentIds.push(r.reservationId);
      return result;
    }),
    markSent: jest.fn(async (id: string) => {
      if (state.markThrowsFor === id) throw new Error('mark failed');
      state.markedIds.push(id);
    }),
    writeLog: jest.fn(async (id: string, _payload: Record<string, unknown>) => {
      if (state.writeLogThrowsFor === id) throw new Error('writeLog failed');
      state.loggedIds.push(id);
    }),
  };
  return deps;
}

describe('processReminders', () => {
  it('まだ送っていない確定予約に送信し、sentAtマークと監査ログを書く', async () => {
    const r1 = makeReservation({ reservationId: 'aaa1' });
    const r2 = makeReservation({ reservationId: 'bbb2' });
    const deps = makeDeps({ reservations: [r1, r2] });

    const result = await processReminders('2026-04-12', deps);

    expect(deps.listForDate).toHaveBeenCalledWith('2026-04-12');
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.state.markedIds).toEqual(['aaa1', 'bbb2']);
    expect(deps.state.loggedIds).toEqual(['aaa1', 'bbb2']);
    expect(result).toEqual({
      date: '2026-04-12',
      candidates: 2,
      sent: 2,
      alreadySent: 0,
      failed: 0,
    });
  });

  it('reminderSentAt が設定済みの予約はスキップして送信しない', async () => {
    const r1 = makeReservation({ reservationId: 'aaa1' });
    const r2 = makeReservation({ reservationId: 'bbb2', reminderSentAt: { _seconds: 1 } });
    const deps = makeDeps({ reservations: [r1, r2] });

    const result = await processReminders('2026-04-12', deps);

    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.send).toHaveBeenCalledWith(r1);
    expect(deps.state.markedIds).toEqual(['aaa1']);
    expect(result).toEqual({
      date: '2026-04-12',
      candidates: 2,
      sent: 1,
      alreadySent: 1,
      failed: 0,
    });
  });

  it('送信が false を返した予約はマーク/ログを書かない', async () => {
    const r1 = makeReservation({ reservationId: 'aaa1' });
    const r2 = makeReservation({ reservationId: 'bbb2' });
    const deps = makeDeps({
      reservations: [r1, r2],
      sendResults: new Map([['bbb2', false]]),
    });

    const result = await processReminders('2026-04-12', deps);

    expect(deps.state.markedIds).toEqual(['aaa1']);
    expect(deps.state.loggedIds).toEqual(['aaa1']);
    expect(result).toEqual({
      date: '2026-04-12',
      candidates: 2,
      sent: 1,
      alreadySent: 0,
      failed: 1,
    });
  });

  it('send が例外を投げてもループは継続し、failed として計上する', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const r1 = makeReservation({ reservationId: 'aaa1' });
    const r2 = makeReservation({ reservationId: 'bbb2' });
    const deps = makeDeps({ reservations: [r1, r2] });
    deps.send.mockImplementationOnce(async () => { throw new Error('boom'); });

    const result = await processReminders('2026-04-12', deps);

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
    consoleSpy.mockRestore();
  });

  it('markSent が失敗した場合は failed 扱いにし、再送可能な状態を保つ', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const r1 = makeReservation({ reservationId: 'aaa1' });
    const deps = makeDeps({
      reservations: [r1],
      markThrowsFor: 'aaa1',
    });

    const result = await processReminders('2026-04-12', deps);

    expect(deps.state.sentIds).toEqual(['aaa1']);
    expect(deps.state.markedIds).toEqual([]);
    expect(deps.state.loggedIds).toEqual([]);
    expect(result).toEqual({
      date: '2026-04-12',
      candidates: 1,
      sent: 0,
      alreadySent: 0,
      failed: 1,
    });
    consoleSpy.mockRestore();
  });

  it('writeLog が失敗しても markSent 完了済みなら sent 扱い（再送しない）', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const r1 = makeReservation({ reservationId: 'aaa1' });
    const deps = makeDeps({
      reservations: [r1],
      writeLogThrowsFor: 'aaa1',
    });

    const result = await processReminders('2026-04-12', deps);

    expect(deps.state.sentIds).toEqual(['aaa1']);
    expect(deps.state.markedIds).toEqual(['aaa1']);
    expect(deps.state.loggedIds).toEqual([]);
    expect(result).toEqual({
      date: '2026-04-12',
      candidates: 1,
      sent: 1,
      alreadySent: 0,
      failed: 0,
    });
    consoleSpy.mockRestore();
  });
});
