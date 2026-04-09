import { Resend } from 'resend';
import { Reservation } from '../../../shared/types';

const FROM_ADDRESS = process.env.MAIL_FROM ?? 'noreply@tri-force-koenji.jp';
const ADMIN_BCC    = process.env.ADMIN_MAIL_BCC ?? '';
const SITE_URL     = process.env.SITE_URL ?? 'https://tri-force-koenji-reservation.web.app';

function getReservationMailName(memberName: string): string {
  return memberName.trim() || '会員';
}

/** Resend クライアントを取得（API キー未設定なら null） */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY is not configured');
    return null;
  }
  return new Resend(apiKey);
}

/** 予約確認メールを送信する（失敗しても例外を投げない） */
export async function sendReservationConfirmation(reservation: Reservation): Promise<void> {
  try {
    const resendClient = getResendClient();
    if (!resendClient) return;

    const subject = `【Tri-force Koenji】施設予約を受け付けました（予約番号: ${reservation.reservationId.slice(0, 8).toUpperCase()}）`;
    const cancelUrl = `${SITE_URL}/cancel?id=${reservation.reservationId}&token=${reservation.cancelToken}`;
    const html = buildConfirmationHtml(reservation, cancelUrl);
    const text = buildConfirmationText(reservation, cancelUrl);

    await resendClient.emails.send({
      from:    FROM_ADDRESS,
      to:      [reservation.email],
      bcc:     ADMIN_BCC ? [ADMIN_BCC] : [],
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('[email] sendReservationConfirmation failed:', err);
  }
}

/** リマインダーメールを送信する（失敗しても例外を投げない） */
export async function sendReminderEmail(reservation: Reservation): Promise<void> {
  try {
    const resendClient = getResendClient();
    if (!resendClient) return;

    const subject = `【Tri-force Koenji】明日の施設予約リマインダー（予約番号: ${reservation.reservationId.slice(0, 8).toUpperCase()}）`;
    const cancelUrl = `${SITE_URL}/cancel?id=${reservation.reservationId}&token=${reservation.cancelToken}`;
    const html = buildReminderHtml(reservation, cancelUrl);
    const text = buildReminderText(reservation, cancelUrl);

    await resendClient.emails.send({
      from:    FROM_ADDRESS,
      to:      [reservation.email],
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('[email] sendReminderEmail failed:', err);
  }
}

// ─── HTML テンプレート ────────────────────────────────────────────────────────

function buildConfirmationHtml(r: Reservation, cancelUrl: string): string {
  const name = getReservationMailName(r.memberName);
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP','Meiryo',sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#2563eb;color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">施設予約を受け付けました</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;">${name} 様</p>
      <p style="margin:0 0 16px;color:#555;">以下の内容で施設予約を受け付けました。</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;width:100px;">予約番号</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;font-family:monospace;">${r.reservationId.slice(0, 8).toUpperCase()}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">施設名</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.facilityName}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">利用日</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.date}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">時間</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.startTime} 〜 ${r.endTime}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">参加人数</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.participants}名</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">利用目的</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(r.purpose)}</td></tr>
        ${r.remarks ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">備考</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(r.remarks)}</td></tr>` : ''}
      </table>
      <p style="margin:0 0 8px;color:#555;font-size:14px;">管理者が会員確認後、予約を確定いたします。確定後に別途ご連絡する場合があります。</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
      <p style="margin:0 0 12px;color:#555;font-size:14px;">予約をキャンセルしたい場合は、以下のボタンからお手続きください。</p>
      <div style="text-align:center;margin:16px 0;">
        <a href="${cancelUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">予約をキャンセルする</a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;color:#999;font-size:12px;">
      Tri-force Koenji
    </div>
  </div>
</body>
</html>`;
}

function buildConfirmationText(r: Reservation, cancelUrl: string): string {
  const name = getReservationMailName(r.memberName);
  return [
    `${name} 様`,
    '',
    '以下の内容で施設予約を受け付けました。',
    '',
    '━━━━━━━━━━━━━━━━',
    `予約番号: ${r.reservationId.slice(0, 8).toUpperCase()}`,
    `施設名  : ${r.facilityName}`,
    `利用日  : ${r.date}`,
    `時間    : ${r.startTime} 〜 ${r.endTime}`,
    `参加人数: ${r.participants}名`,
    `利用目的: ${r.purpose}`,
    r.remarks ? `備考    : ${r.remarks}` : '',
    '━━━━━━━━━━━━━━━━',
    '',
    '管理者が会員確認後、予約を確定いたします。',
    '確定後に別途ご連絡する場合があります。',
    '',
    '予約をキャンセルする場合は以下のURLにアクセスしてください:',
    cancelUrl,
    '',
    'Tri-force Koenji',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function buildReminderHtml(r: Reservation, cancelUrl: string): string {
  const name = getReservationMailName(r.memberName);
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP','Meiryo',sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#f59e0b;color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">明日の施設予約リマインダー</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;">${name} 様</p>
      <p style="margin:0 0 16px;color:#555;">明日の施設予約についてお知らせいたします。</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;width:100px;">予約番号</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;font-family:monospace;">${r.reservationId.slice(0, 8).toUpperCase()}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">施設名</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.facilityName}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">利用日</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.date}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">時間</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.startTime} 〜 ${r.endTime}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">参加人数</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.participants}名</td></tr>
      </table>
      <p style="margin:0 0 8px;color:#555;font-size:14px;">ご来店をお待ちしております。</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
      <p style="margin:0 0 12px;color:#555;font-size:14px;">ご都合が悪くなった場合は、以下からキャンセルできます。</p>
      <div style="text-align:center;margin:16px 0;">
        <a href="${cancelUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">予約をキャンセルする</a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;color:#999;font-size:12px;">
      Tri-force Koenji
    </div>
  </div>
</body>
</html>`;
}

function buildReminderText(r: Reservation, cancelUrl: string): string {
  const name = getReservationMailName(r.memberName);
  return [
    `${name} 様`,
    '',
    '明日の施設予約についてお知らせいたします。',
    '',
    '━━━━━━━━━━━━━━━━',
    `予約番号: ${r.reservationId.slice(0, 8).toUpperCase()}`,
    `施設名  : ${r.facilityName}`,
    `利用日  : ${r.date}`,
    `時間    : ${r.startTime} 〜 ${r.endTime}`,
    `参加人数: ${r.participants}名`,
    '━━━━━━━━━━━━━━━━',
    '',
    'ご来店をお待ちしております。',
    '',
    'ご都合が悪くなった場合は以下のURLからキャンセルできます:',
    cancelUrl,
    '',
    'Tri-force Koenji',
  ].join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
