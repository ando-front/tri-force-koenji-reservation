import { buildMyReservationUrl, buildReservationConfirmationEmail } from './notificationTemplate';
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
    status: 'pending',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('buildMyReservationUrl', () => {
  it('FRONTEND_BASE_URL があれば絶対URLを返す', () => {
    expect(buildMyReservationUrl('ABC12345', 'https://example.com'))
      .toBe('https://example.com/my-reservation?code=ABC12345');
  });

  it('末尾スラッシュを正規化する', () => {
    expect(buildMyReservationUrl('ABC12345', 'https://example.com/'))
      .toBe('https://example.com/my-reservation?code=ABC12345');
  });

  it('FRONTEND_BASE_URL が未指定なら相対パスを返す', () => {
    expect(buildMyReservationUrl('ABC12345')).toBe('/my-reservation?code=ABC12345');
  });

  it('javascript: などの非http(s)スキームは相対パスにフォールバックする', () => {
    expect(buildMyReservationUrl('ABC12345', 'javascript:alert(1)'))
      .toBe('/my-reservation?code=ABC12345');
    expect(buildMyReservationUrl('ABC12345', 'data:text/html,foo'))
      .toBe('/my-reservation?code=ABC12345');
  });

  it('パースできない値は相対パスにフォールバックする', () => {
    expect(buildMyReservationUrl('ABC12345', 'not-a-url')).toBe('/my-reservation?code=ABC12345');
    expect(buildMyReservationUrl('ABC12345', '')).toBe('/my-reservation?code=ABC12345');
  });

  it('path/query/hash を含む baseUrl は誤設定とみなして相対パスにフォールバックする', () => {
    expect(buildMyReservationUrl('ABC12345', 'https://example.com/sub/path'))
      .toBe('/my-reservation?code=ABC12345');
    expect(buildMyReservationUrl('ABC12345', 'https://example.com?x=1'))
      .toBe('/my-reservation?code=ABC12345');
    expect(buildMyReservationUrl('ABC12345', 'https://example.com#frag'))
      .toBe('/my-reservation?code=ABC12345');
  });
});

describe('buildReservationConfirmationEmail', () => {
  const baseUrl = 'https://example.com';

  it('subject に8桁の予約番号を含める', () => {
    const r = makeReservation();
    const { subject } = buildReservationConfirmationEmail(r, { frontendBaseUrl: baseUrl });
    expect(subject).toContain('ABC12345');
  });

  it('text にもHTML本文にも詳細項目を含める', () => {
    const r = makeReservation({ remarks: '備考メモ' });
    const { text, html } = buildReservationConfirmationEmail(r, { frontendBaseUrl: baseUrl });
    for (const fragment of ['ABC12345', 'フリーマット', '2026-04-12', '10:00', '11:00', '2名', '自主練習', '備考メモ']) {
      expect(text).toContain(fragment);
      expect(html).toContain(fragment);
    }
  });

  it('memberName が空のときは text/HTML どちらも「会員 様」になる', () => {
    const r = makeReservation({ memberName: '' });
    const { text, html } = buildReservationConfirmationEmail(r, { frontendBaseUrl: baseUrl });
    expect(text).toMatch(/^会員 様/);
    expect(html).toContain('会員 様');
  });

  it('HTMLに /my-reservation のリンクが入り、code パラメータを渡す', () => {
    const r = makeReservation();
    const { html, text } = buildReservationConfirmationEmail(r, { frontendBaseUrl: baseUrl });
    const expectedUrl = 'https://example.com/my-reservation?code=ABC12345';
    expect(html).toContain(`href="${expectedUrl}"`);
    expect(text).toContain(expectedUrl);
  });

  it('memberName のHTML特殊文字をエスケープする', () => {
    const r = makeReservation({ memberName: '<script>alert(1)</script>' });
    const { html } = buildReservationConfirmationEmail(r);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('remarks が空のときは備考行を含めない', () => {
    const r = makeReservation({ remarks: '' });
    const { text, html } = buildReservationConfirmationEmail(r, { frontendBaseUrl: baseUrl });
    expect(text).not.toMatch(/備考\s*:/);
    expect(html).not.toContain('>備考<');
  });

  it('remarks が空白のみのときも備考行を含めない', () => {
    const r = makeReservation({ remarks: '   \n\t  ' });
    const { text, html } = buildReservationConfirmationEmail(r, { frontendBaseUrl: baseUrl });
    expect(text).not.toMatch(/備考\s*:/);
    expect(html).not.toContain('>備考<');
  });

  it('remarks の前後空白は除去して表示する', () => {
    const r = makeReservation({ remarks: '  実メモ  ' });
    const { text, html } = buildReservationConfirmationEmail(r, { frontendBaseUrl: baseUrl });
    expect(text).toContain('備考    : 実メモ');
    expect(html).toContain('実メモ');
    expect(html).not.toContain('  実メモ  ');
  });
});
