import { buildReservationIcal } from './ical';
import type { Reservation } from '../../../shared/types';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    reservationId: 'abc12345xyz9KlMnOpQ',
    memberName: 'ケンジ',
    email: 'kenji@example.com',
    facilityId: 'free-mat',
    facilityName: 'フリーマット',
    date: '2026-04-12',
    startTime: '10:00',
    endTime: '11:00',
    purpose: '自主練習',
    participants: 2,
    remarks: '',
    status: 'confirmed',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('buildReservationIcal', () => {
  it('VCALENDAR/VEVENT のラッパーと CRLF 改行を出力する', () => {
    const ics = buildReservationIcal(makeReservation());
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('END:VEVENT\r\n');
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('PRODID:-//Tri-force Koenji//Reservation//JA\r\n');
  });

  it('UID にreservationIdを使い、SUMMARYに施設名と予約コードを含める', () => {
    const ics = buildReservationIcal(makeReservation());
    expect(ics).toContain('UID:abc12345xyz9KlMnOpQ@tri-force-koenji\r\n');
    expect(ics).toContain('SUMMARY:フリーマット 予約 (ABC12345)\r\n');
  });

  it('JST の DTSTART/DTEND を UTC 表記に変換する (10:00 JST → 01:00 UTC)', () => {
    const ics = buildReservationIcal(makeReservation({
      date: '2026-04-12',
      startTime: '10:00',
      endTime: '11:00',
    }));
    expect(ics).toContain('DTSTART:20260412T010000Z\r\n');
    expect(ics).toContain('DTEND:20260412T020000Z\r\n');
  });

  it('JSTで日付をまたぐイベントは UTC で前日になる (00:30 JST → 15:30 UTC 前日)', () => {
    const ics = buildReservationIcal(makeReservation({
      date: '2026-04-12',
      startTime: '00:30',
      endTime: '01:30',
    }));
    expect(ics).toContain('DTSTART:20260411T153000Z\r\n');
    expect(ics).toContain('DTEND:20260411T163000Z\r\n');
  });

  it('myReservationUrl が指定されると DESCRIPTION と URL に出力する', () => {
    const ics = buildReservationIcal(makeReservation(), {
      myReservationUrl: 'https://example.com/my-reservation?code=ABC12345',
    });
    expect(ics).toContain('URL:https://example.com/my-reservation?code=ABC12345\r\n');
    expect(ics).toContain('詳細・キャンセル:');
  });

  it('TEXT エスケープ: ; , \\ を保護し、改行は \\n に置換する', () => {
    const ics = buildReservationIcal(makeReservation({
      facilityName: 'A; B, C\\D',
      purpose: '行1\n行2',
    }));
    expect(ics).toContain('A\\; B\\, C\\\\D');
    expect(ics).toContain('行1\\n行2');
  });

  it('cancelled 予約は STATUS:CANCELLED を出力する', () => {
    const ics = buildReservationIcal(makeReservation({ status: 'cancelled' }));
    expect(ics).toContain('STATUS:CANCELLED\r\n');
  });

  it('confirmed/pending 予約は STATUS:CONFIRMED を出力する', () => {
    expect(buildReservationIcal(makeReservation({ status: 'confirmed' }))).toContain('STATUS:CONFIRMED\r\n');
    expect(buildReservationIcal(makeReservation({ status: 'pending' }))).toContain('STATUS:CONFIRMED\r\n');
  });

  it('purpose が空でも本文を生成し、行数が増えない', () => {
    const ics = buildReservationIcal(makeReservation({ purpose: '' }));
    expect(ics).not.toContain('利用目的:');
    expect(ics).toContain('SUMMARY:フリーマット 予約 (ABC12345)\r\n');
  });
});
