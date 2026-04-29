import type { Reservation, ReservationStatus } from '../../../shared/types';

/**
 * 予約から iCalendar (RFC 5545) 形式の文字列を生成する純関数。
 *
 * - すべての時刻は JST (Asia/Tokyo, UTC+9) と解釈し、UTC に変換した
 *   UTC 形式 (Z 終端) で出力する。
 * - SUMMARY に施設名、DESCRIPTION に予約番号と詳細URLを含める。
 * - 改行は CRLF（RFC 5545 必須）。
 * - 75 octets を超える行は CRLF + 先頭スペースで folding する。
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
  // 実改行で結合し、escapeIcalText の改行ルールに任せて RFC5545 の \n に変換させる
  const description = descLines.join('\n');

  const rawLines: string[] = [
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
    `STATUS:${statusForIcal(reservation.status)}`,
    options.myReservationUrl ? `URL:${sanitizeIcalUri(options.myReservationUrl)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);

  // RFC5545 は改行を CRLF と規定し、長い行は folding が必須
  return rawLines.map(foldIcalLine).join('\r\n') + '\r\n';
}

/** RFC5545 TEXT エスケープ: バックスラッシュ・カンマ・セミコロン・改行を制御 */
function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * URL 値はTEXTではなく VALUE=URI として扱われるため、
 * バックスラッシュエスケープは行わない。安全のため改行類のみ除去する。
 */
function sanitizeIcalUri(value: string): string {
  return value.replace(/[\r\n]+/g, '');
}

function statusForIcal(status: ReservationStatus): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' {
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'pending')   return 'TENTATIVE';
  return 'CONFIRMED';
}

/**
 * RFC 5545 §3.1: コンテンツ行は 75 octets を超えてはならず、
 * 超える場合は CRLF + (SPACE|TAB) で folding する。
 * UTF-8 マルチバイト文字の途中で分割しないよう、文字単位で切る。
 */
function foldIcalLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  // 続行行はバイト配分が「先頭スペース 1 octet」分減るため、最初の行と区別する
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    const max = chunks.length === 0 ? 75 : 74; // 続行行は先頭スペース込みで75
    if (currentBytes + chBytes > max) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current.length > 0) chunks.push(current);

  return chunks.map((c, i) => (i === 0 ? c : ' ' + c)).join('\r\n');
}

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, '0');
}

/** "YYYY-MM-DD" + "HH:MM" (JST) を ISO UTC 形式 (YYYYMMDDTHHMMSSZ) に変換 */
function formatJstAsUtc(date: string, time: string): string {
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
