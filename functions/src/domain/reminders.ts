import type { Reservation } from '../../../shared/types';

export interface ReminderProcessingDeps {
  /** 指定日付の確定予約を取得 */
  listForDate: (date: string) => Promise<Reservation[]>;
  /** 指定予約にリマインダーメールを送信。成否を返す */
  send: (reservation: Reservation) => Promise<boolean>;
  /** 送信済みフラグを立てる */
  markSent: (reservationId: string) => Promise<void>;
  /** 監査ログを書く */
  writeLog: (reservationId: string, payload: Record<string, unknown>) => Promise<void>;
}

export interface ReminderProcessingResult {
  date: string;
  candidates: number;
  sent: number;
  alreadySent: number;
  failed: number;
}

/**
 * 指定日のリマインダー送信処理を実行する純関数。
 * Firestore / Resend / Logger との結合は依存注入で外に追い出してテスト可能にする。
 */
export async function processReminders(
  date: string,
  deps: ReminderProcessingDeps
): Promise<ReminderProcessingResult> {
  const reservations = await deps.listForDate(date);

  let sent = 0;
  let alreadySent = 0;
  let failed = 0;

  for (const r of reservations) {
    if (r.reminderSentAt) {
      alreadySent += 1;
      continue;
    }
    let ok = false;
    try {
      ok = await deps.send(r);
    } catch (err) {
      console.error('[reminder] send threw:', err);
      ok = false;
    }
    if (!ok) {
      failed += 1;
      continue;
    }
    try {
      await deps.markSent(r.reservationId);
      await deps.writeLog(r.reservationId, {
        date:       r.date,
        startTime:  r.startTime,
        facilityId: r.facilityId,
      });
      sent += 1;
    } catch (err) {
      // 送信は成功したがマーク/ログに失敗した場合は failed とみなして
      // 次回起動時に再送できるようにする（重複送信が起きうるが許容）
      console.error('[reminder] markSent/writeLog failed:', err);
      failed += 1;
    }
  }

  return {
    date,
    candidates: reservations.length,
    sent,
    alreadySent,
    failed,
  };
}
