import { Resend } from 'resend';
import { Reservation } from '../../../shared/types';

const FROM_ADDRESS = process.env.MAIL_FROM ?? 'noreply@tri-force-koenji.jp';
const ADMIN_BCC    = process.env.ADMIN_MAIL_BCC ?? '';

function getReservationMailName(memberName: string): string {
  return memberName.trim() || '会員';
}

/** 予約確認メールを送信する（失敗しても例外を投げない） */
export async function sendReservationConfirmation(reservation: Reservation): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[email] RESEND_API_KEY is not configured');
      return;
    }

    const resendClient = new Resend(apiKey);
    const subject = `【Tri-force Koenji】施設予約を受け付けました（予約番号: ${reservation.reservationId.slice(0, 8).toUpperCase()}）`;
    const text = buildConfirmationText(reservation);

    await resendClient.emails.send({
      from:    FROM_ADDRESS,
      to:      [reservation.email],
      bcc:     ADMIN_BCC ? [ADMIN_BCC] : [],
      subject,
      text,
    });
  } catch (err) {
    // メール失敗はログだけ記録し、予約処理は成功として扱う
    console.error('[email] sendReservationConfirmation failed:', err);
  }
}

function buildConfirmationText(r: Reservation): string {
  return [
    `${getReservationMailName(r.memberName)} 様`,
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
    'Tri-force Koenji',
  ]
    .filter((line) => line !== null)
    .join('\n');
}
