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
    expect(ics).toContain('URL:https://example.com/my-reservation?code=ABC12345');
    expect(ics).toContain('詳細・キャンセル:');
  });

  it('URL プロパティは TEXT エスケープを受けない (, ; \\ がそのまま残る)', () => {
    const ics = buildReservationIcal(makeReservation(), {
      myReservationUrl: 'https://example.com/p?a=1,2;b=3',
    });
    // URL: 行のみを抽出してエスケープが入っていないことを検証
    // (DESCRIPTION は TEXT 型なのでエスケープされる別物)
    const urlLine = ics.split(/\r\n/).find((l) => l.startsWith('URL:')) ?? '';
    expect(urlLine).toBe('URL:https://example.com/p?a=1,2;b=3');
    expect(urlLine).not.toMatch(/\\,/);
    expect(urlLine).not.toMatch(/\\;/);
  });

  it('URL の CR/LF は除去される', () => {
    const ics = buildReservationIcal(makeReservation(), {
      myReservationUrl: 'https://example.com/p\r\n?evil=1',
    });
    expect(ics).toContain('URL:https://example.com/p?evil=1');
  });

  it('TEXT エスケープ: ; , \\ を保護し、改行は \\n に置換する', () => {
    const ics = buildReservationIcal(makeReservation({
      facilityName: 'A; B, C\\D',
      purpose: '行1\n行2',
    }));
    expect(ics).toContain('A\\; B\\, C\\\\D');
    expect(ics).toContain('行1\\n行2');
  });

  it('DESCRIPTION の改行は単一バックスラッシュ \\n になる（二重エスケープしない）', () => {
    const ics = buildReservationIcal(makeReservation(), {
      myReservationUrl: 'https://example.com/p',
    });
    // DESCRIPTION 内の行間は `\n` (1個のバックスラッシュ + n) であって `\\n` (2個 + n) ではない
    expect(ics).toMatch(/DESCRIPTION:[^\r\n]*予約番号: ABC12345\\n施設:/);
    expect(ics).not.toMatch(/DESCRIPTION:[^\r\n]*\\\\n施設:/);
  });

  it('cancelled 予約は STATUS:CANCELLED を出力する', () => {
    const ics = buildReservationIcal(makeReservation({ status: 'cancelled' }));
    expect(ics).toContain('STATUS:CANCELLED\r\n');
  });

  it('confirmed 予約は STATUS:CONFIRMED を出力する', () => {
    expect(buildReservationIcal(makeReservation({ status: 'confirmed' }))).toContain('STATUS:CONFIRMED\r\n');
  });

  it('pending 予約は STATUS:TENTATIVE を出力する（カレンダー側で仮予約として表示）', () => {
    expect(buildReservationIcal(makeReservation({ status: 'pending' }))).toContain('STATUS:TENTATIVE\r\n');
  });

  it('75 octets を超える行は CRLF + 先頭スペースで folding される', () => {
    const longUrl = 'https://example.com/very/long/path/that/exceeds/seventy-five-octets-in-length/for-testing-rfc5545-folding-behaviour-please-please';
    const ics = buildReservationIcal(makeReservation(), { myReservationUrl: longUrl });
    // URL 行が複数行に折り返されていること
    const urlPosition = ics.indexOf('URL:');
    const afterUrl = ics.slice(urlPosition);
    // 折り返しがある場合は \r\n + space が含まれる
    expect(afterUrl).toMatch(/URL:[^\r\n]+\r\n [^\r\n]+/);
  });

  it('purpose が空でも本文を生成し、行数が増えない', () => {
    const ics = buildReservationIcal(makeReservation({ purpose: '' }));
    expect(ics).not.toContain('利用目的:');
    expect(ics).toContain('SUMMARY:フリーマット 予約 (ABC12345)\r\n');
  });
});
