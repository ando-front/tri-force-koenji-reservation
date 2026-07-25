/**
 * 旧 functions/src/domain/ical.ts をそのまま移植（設計書 5.3: core はテストごと移植可能）。
 * timestamptz モデルに合わせ、入力を「date + startTime/endTime の文字列」ではなく
 * `startsAt` / `endsAt`（Date, UTC instant）で受け取るように変更した。
 */

export type ReservationStatusForIcal = 'pending' | 'confirmed' | 'cancelled';

export interface IcalReservation {
  id: string;
  facilityName: string;
  startsAt: Date;
  endsAt: Date;
  participants: number;
  purpose?: string;
  status: ReservationStatusForIcal;
}

/** 会員向け予約確認・キャンセル画面への URL を生成する。 */
export function buildMyReservationUrl(code: string, baseUrl?: string): string {
  const path = `/my-reservation?code=${encodeURIComponent(code)}`;
  if (!baseUrl) return path;

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return path;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return path;
  if (parsed.pathname !== '/' && parsed.pathname !== '') return path;
  if (parsed.search) return path;
  if (parsed.hash) return path;

  return `${parsed.origin}${path}`;
}

/**
 * 予約から iCalendar (RFC 5545) 形式の文字列を生成する純関数。
 * timestamptz 化により JST→UTC 変換は呼び出し側（DB から読んだ Date）で完結しており、
 * ここでは文字列の日付・時刻を組み立て直す必要がない（旧実装より単純）。
 */
export function buildReservationIcal(
  reservation: IcalReservation,
  options: { myReservationUrl?: string } = {},
): string {
  const code = reservation.id.slice(0, 8).toUpperCase();
  const dtstamp = formatUtc(new Date());
  const dtstart = formatUtc(reservation.startsAt);
  const dtend = formatUtc(reservation.endsAt);

  const summary = `${reservation.facilityName} 予約 (${code})`;

  const descLines: string[] = [
    `予約番号: ${code}`,
    `施設: ${reservation.facilityName}`,
    `参加人数: ${reservation.participants}名`,
  ];
  if (reservation.purpose) descLines.push(`利用目的: ${reservation.purpose}`);
  if (options.myReservationUrl) {
    descLines.push('', '詳細・キャンセル:', options.myReservationUrl);
  }
  const description = descLines.join('\n');

  const rawLines: (string | null)[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tri-force Koenji//Reservation//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${reservation.id}@tri-force-koenji`,
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
  ];

  return (
    rawLines
      .filter((l): l is string => l !== null)
      .map(foldIcalLine)
      .join('\r\n') + '\r\n'
  );
}

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function sanitizeIcalUri(value: string): string {
  return value.replace(/[\r\n]+/g, '');
}

function statusForIcal(status: ReservationStatusForIcal): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' {
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'pending') return 'TENTATIVE';
  return 'CONFIRMED';
}

function foldIcalLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    const max = chunks.length === 0 ? 75 : 74;
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
