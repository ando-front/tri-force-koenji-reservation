import { Resend } from 'resend';
import { Reservation } from '../../../shared/types';
import {
  buildCancellationNotificationEmail,
  buildReservationConfirmationEmail,
  CancellationEmailOptions,
} from './notificationTemplate';

const FROM_ADDRESS = process.env.MAIL_FROM ?? 'noreply@tri-force-koenji.jp';
const ADMIN_BCC    = process.env.ADMIN_MAIL_BCC ?? '';

/** 予約確認メールを送信する（失敗しても例外を投げない） */
export async function sendReservationConfirmation(reservation: Reservation): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[email] RESEND_API_KEY is not configured');
      return;
    }

    const resendClient = new Resend(apiKey);
    const { subject, text, html } = buildReservationConfirmationEmail(reservation, {
      frontendBaseUrl: process.env.FRONTEND_BASE_URL,
    });

    await resendClient.emails.send({
      from:    FROM_ADDRESS,
      to:      [reservation.email],
      bcc:     ADMIN_BCC ? [ADMIN_BCC] : [],
      subject,
      text,
      html,
    });
  } catch (err) {
    // メール失敗はログだけ記録し、予約処理は成功として扱う
    console.error('[email] sendReservationConfirmation failed:', err);
  }
}

/**
 * キャンセル通知メールを送信する（失敗しても例外を投げない）。
 * 会員には常に通知し、ADMIN_MAIL_BCC が設定されていれば運営にも BCC で通知する。
 */
export async function sendCancellationNotification(
  reservation: Reservation,
  options: CancellationEmailOptions
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[email] RESEND_API_KEY is not configured');
      return;
    }

    const resendClient = new Resend(apiKey);
    const { subject, text, html } = buildCancellationNotificationEmail(reservation, options);

    await resendClient.emails.send({
      from:    FROM_ADDRESS,
      to:      [reservation.email],
      bcc:     ADMIN_BCC ? [ADMIN_BCC] : [],
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('[email] sendCancellationNotification failed:', err);
  }
}
