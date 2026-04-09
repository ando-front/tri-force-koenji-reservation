import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import { Reservation } from '../../shared/types';
import { sendReminderEmail } from './domain/notification';

/**
 * 毎日 18:00 JST に翌日の予約に対してリマインダーメールを送信する。
 * cancelled 以外 (pending / confirmed) の予約が対象。
 */
export const sendDailyReminder = functions.onSchedule(
  {
    schedule:  '0 18 * * *',       // 毎日 18:00 UTC+9 (JST)
    timeZone:  'Asia/Tokyo',
    region:    'asia-northeast1',
    memory:    '256MiB',
    maxInstances: 1,
    retryCount: 1,
  },
  async () => {
    const tomorrow = getTomorrowDateString();
    console.log(`[reminder] Sending reminders for date=${tomorrow}`);

    const db = admin.firestore();
    const snap = await db
      .collection('reservations')
      .where('date', '==', tomorrow)
      .where('status', 'in', ['pending', 'confirmed'])
      .get();

    if (snap.empty) {
      console.log('[reminder] No reservations found for tomorrow');
      return;
    }

    console.log(`[reminder] Found ${snap.size} reservation(s)`);

    const results = await Promise.allSettled(
      snap.docs.map(async (doc) => {
        const reservation = { reservationId: doc.id, ...doc.data() } as Reservation;
        await sendReminderEmail(reservation);
        return reservation.reservationId;
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[reminder] Done: ${succeeded} sent, ${failed} failed`);
  },
);

/** 翌日の日付文字列 "YYYY-MM-DD" を JST で返す */
function getTomorrowDateString(): string {
  const now = new Date();
  // JST = UTC + 9h
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const tomorrow = new Date(jstNow);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const y = tomorrow.getUTCFullYear();
  const m = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
