import { Resend } from 'resend';
import { Reservation } from '../../../shared/types';
import {
  buildCancellationNotificationEmail,
  buildReminderEmail,
  buildReservationConfirmationEmail,
  CancellationEmailOptions,
} from './notificationTemplate';

const FROM_ADDRESS = process.env.MAIL_FROM ?? 'noreply@tri-force-koenji.jp';
const ADMIN_BCC    = process.env.ADMIN_MAIL_BCC ?? '';

/**
 * Resend SDK v3 の `emails.send` は HTTP 4xx/5xx を例外ではなく
 * `{ data: null, error: {...} }` で返す仕様。チェックを忘れると
 * APIキー不正・差出ドメイン未検証・宛先拒否などが無音で握り潰される。
 * 送信成否を明示的に判定し、失敗時はログに残しつつ false を返す。
 */
async function sendViaResend(
  resendClient: Resend,
  payload: {
    from: string;
    to: string[];
    bcc?: string[];
    subject: string;
    text: string;
    html: string;
  },
  context: string,
): Promise<boolean> {
  const { error, data } = await resendClient.emails.send(payload);
  if (error) {
    console.error(`[email] ${context} rejected by Resend:`, error);
    return false;
  }
  if (!data) {
    console.error(`[email] ${context} returned no data from Resend`);
    return false;
  }
  return true;
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
    const { subject, text, html } = buildReservationConfirmationEmail(reservation, {
      frontendBaseUrl: process.env.FRONTEND_BASE_URL,
    });

    await sendViaResend(
      resendClient,
      {
        from:    FROM_ADDRESS,
        to:      [reservation.email],
        bcc:     ADMIN_BCC ? [ADMIN_BCC] : [],
        subject,
        text,
        html,
      },
      'sendReservationConfirmation',
    );
  } catch (err) {
    // メール失敗はログだけ記録し、予約処理は成功として扱う
    console.error('[email] sendReservationConfirmation failed:', err);
  }
}

/**
 * 翌日の予約リマインダーメールを送信する。
 * 他の通知関数と異なり、呼び出し側で成否に応じて `reminderSentAt` を立てる必要があるため、
 * boolean を返す（true=送信成功 / false=設定不備または送信失敗）。
 */
export async function sendReminderEmail(reservation: Reservation): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[email] RESEND_API_KEY is not configured; skipping reminder');
      return false;
    }

    const resendClient = new Resend(apiKey);
    const { subject, text, html } = buildReminderEmail(reservation, {
      frontendBaseUrl: process.env.FRONTEND_BASE_URL,
    });

    return await sendViaResend(
      resendClient,
      {
        from:    FROM_ADDRESS,
        to:      [reservation.email],
        subject,
        text,
        html,
      },
      'sendReminderEmail',
    );
  } catch (err) {
    console.error('[email] sendReminderEmail failed:', err);
    return false;
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

    await sendViaResend(
      resendClient,
      {
        from:    FROM_ADDRESS,
        to:      [reservation.email],
        bcc:     ADMIN_BCC ? [ADMIN_BCC] : [],
        subject,
        text,
        html,
      },
      'sendCancellationNotification',
    );
  } catch (err) {
    console.error('[email] sendCancellationNotification failed:', err);
  }
}
