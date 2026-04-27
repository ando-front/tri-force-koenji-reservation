import { onSchedule } from 'firebase-functions/v2/scheduler';
import { shiftDateString, todayJst } from '../domain/date';
import { processReminders } from '../domain/reminders';
import { sendReminderEmail } from '../domain/notification';
import {
  listConfirmedReservationsByDate,
  markReminderSent,
  writeAuditLog,
} from '../infra/firestoreRepository';

/**
 * 毎日 18:00 JST に翌日分の確定予約へリマインダーメールを送る。
 * Firebase v2 の onSchedule が Cloud Scheduler ジョブを自動作成する。
 */
export const sendReservationReminders = onSchedule(
  {
    schedule: '0 18 * * *',
    timeZone: 'Asia/Tokyo',
    region:   'asia-northeast1',
    retryCount: 1,
    memory:   '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const targetDate = shiftDateString(todayJst(), 1);

    const result = await processReminders(targetDate, {
      listForDate: listConfirmedReservationsByDate,
      send:        sendReminderEmail,
      markSent:    markReminderSent,
      writeLog:    (id, payload) =>
        writeAuditLog('system', 'reservation.reminder_sent', id, payload),
    });

    console.log('[reminder]', JSON.stringify(result));

    // 1件でも送信失敗があればハンドラを失敗終了させて Cloud Scheduler の retry を発火させる。
    // markSent は失敗時に立てないので、retry 中も対象として残り、再送される。
    if (result.failed > 0) {
      throw new Error(
        `Reminder delivery failed for ${result.failed} reservation(s) on ${targetDate}`
      );
    }
  }
);
