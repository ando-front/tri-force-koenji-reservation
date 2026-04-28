import type { Reservation } from '../../../shared/types';

/**
 * 予約から iCalendar (RFC 5545) 形式の文字列を生成する純関数。
 *
 * - すべての時刻は JST (Asia/Tokyo, UTC+9) と解釈し、UTC に変換した
 *   UTC 形式 (Z 終端) で出力する。タイムゾーン定義 (VTIMEZONE) を
 *   持たない最小フォーマットだが、Google Calendar / Apple Calendar /
 *   Outlook いずれも UTC イベントとして正しく取り込める。
 * - SUMMARY に施設名、DESCRIPTION に予約番号と詳細URLを含める。
 * - 改行は CRLF（RFC 5545 必須）。
 */
export function buildReservationIcal(
  reservation: Reservation,
  options: { myReservationUrl?: string } = {}
): string {
  const code = reservation.reservationId.slice(0, 8).toUpperCase();
  const dtstamp = formatUtc(new Date());
  const dtstart = formatJstAsUtc(reservation.date, reservation.startTime);
  const dtend   = formatJstAsUtc(reservation.date, reservation.endTime);

  const summary  = `${reservation.facilityName} 予約 (${code})`;
  const descLines: string[] = [
    `予約番号: ${code}`,
    `施設: ${reservation.facilityName}`,
    `参加人数: ${reservation.participants}名`,
  ];
  if (reservation.purpose) descLines.push(`利用目的: ${reservation.purpose}`);
  if (options.myReservationUrl) {
    descLines.push('', '詳細・キャンセル:', options.myReservationUrl);
  }
  const description = descLines.join('\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tri-force Koenji//Reservation//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${reservation.reservationId}@tri-force-koenji`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcalText(summary)}`,
    `LOCATION:${escapeIcalText('Tri-force Koenji')}`,
    `DESCRIPTION:${escapeIcalText(description)}`,
    `STATUS:${reservation.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    options.myReservationUrl ? `URL:${escapeIcalText(options.myReservationUrl)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);

  // RFC5545 は改行を CRLF と規定
  return lines.join('\r\n') + '\r\n';
}

/** RFC5545 TEXT エスケープ: バックスラッシュ・カンマ・セミコロン・改行を制御 */
function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, '0');
}

/** "YYYY-MM-DD" + "HH:MM" (JST) を ISO UTC 形式 (YYYYMMDDTHHMMSSZ) に変換 */
function formatJstAsUtc(date: string, time: string): string {
  // "2026-04-12T10:00:00+09:00" として解釈し UTC へ
  const iso = `${date}T${time}:00+09:00`;
  const d = new Date(iso);
  return formatUtc(d);
}

function formatUtc(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}
