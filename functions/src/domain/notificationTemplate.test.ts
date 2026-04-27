import {
  buildCancellationNotificationEmail,
  buildMyReservationUrl,
  buildReminderEmail,
  buildReservationConfirmationEmail,
} from './notificationTemplate';
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

describe('buildCancellationNotificationEmail', () => {
  it('subject にキャンセル文言と8桁コードを含める', () => {
    const r = makeReservation();
    const { subject } = buildCancellationNotificationEmail(r, { triggeredBy: 'member' });
    expect(subject).toContain('キャンセル');
    expect(subject).toContain('ABC12345');
  });

  it('triggeredBy=member のときは「キャンセルしました」文言と再予約案内を入れる', () => {
    const r = makeReservation();
    const { text, html } = buildCancellationNotificationEmail(r, { triggeredBy: 'member' });
    expect(text).toContain('予約をキャンセルしました');
    expect(text).toContain('再予約');
    expect(html).toContain('予約をキャンセルしました');
    expect(html).not.toContain('運営側で');
  });

  it('triggeredBy=admin のときは「運営側でキャンセルしました」文言を入れる', () => {
    const r = makeReservation();
    const { text, html } = buildCancellationNotificationEmail(r, { triggeredBy: 'admin' });
    expect(text).toContain('運営側で');
    expect(html).toContain('運営側で予約をキャンセルしました');
  });

  it('cancelReason があれば本文・HTMLに表示する', () => {
    const r = makeReservation();
    const { text, html } = buildCancellationNotificationEmail(r, {
      triggeredBy: 'admin',
      cancelReason: '会員都合',
    });
    expect(text).toContain('キャンセル理由: 会員都合');
    expect(html).toContain('キャンセル理由');
    expect(html).toContain('会員都合');
  });

  it('cancelReason が空白のみなら理由行を含めない', () => {
    const r = makeReservation();
    const { text, html } = buildCancellationNotificationEmail(r, {
      triggeredBy: 'member',
      cancelReason: '   ',
    });
    expect(text).not.toMatch(/キャンセル理由/);
    expect(html).not.toContain('キャンセル理由');
  });

  it('cancelReason のHTML特殊文字をエスケープする', () => {
    const r = makeReservation();
    const { html } = buildCancellationNotificationEmail(r, {
      triggeredBy: 'member',
      cancelReason: '<img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('memberName が空でも「会員 様」で挨拶を返す', () => {
    const r = makeReservation({ memberName: '' });
    const { text, html } = buildCancellationNotificationEmail(r, { triggeredBy: 'member' });
    expect(text).toMatch(/^会員 様/);
    expect(html).toContain('会員 様');
  });
});

describe('buildReminderEmail', () => {
  const baseUrl = 'https://example.com';

  it('subject にリマインダー文言と8桁コードを含める', () => {
    const r = makeReservation();
    const { subject } = buildReminderEmail(r, { frontendBaseUrl: baseUrl });
    expect(subject).toContain('明日');
    expect(subject).toContain('ABC12345');
  });

  it('text/HTML どちらにも予約詳細とキャンセルリンクを含める', () => {
    const r = makeReservation();
    const { text, html } = buildReminderEmail(r, { frontendBaseUrl: baseUrl });
    for (const fragment of ['ABC12345', 'フリーマット', '2026-04-12', '10:00', '11:00', '2名', '自主練習']) {
      expect(text).toContain(fragment);
      expect(html).toContain(fragment);
    }
    const expectedUrl = 'https://example.com/my-reservation?code=ABC12345';
    expect(html).toContain(`href="${expectedUrl}"`);
    expect(text).toContain(expectedUrl);
  });

  it('memberName が空のときは「会員 様」で挨拶を返す', () => {
    const r = makeReservation({ memberName: '' });
    const { text, html } = buildReminderEmail(r, { frontendBaseUrl: baseUrl });
    expect(text).toMatch(/^会員 様/);
    expect(html).toContain('会員 様');
  });

  it('memberName のHTML特殊文字をエスケープする', () => {
    const r = makeReservation({ memberName: '<b>x</b>' });
    const { html } = buildReminderEmail(r);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('FRONTEND_BASE_URL 未指定時もリンクは相対パスで埋め込まれる', () => {
    const r = makeReservation();
    const { html, text } = buildReminderEmail(r);
    expect(html).toContain('href="/my-reservation?code=ABC12345"');
    expect(text).toContain('/my-reservation?code=ABC12345');
  });
});
