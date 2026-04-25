import { Reservation } from '../../../shared/types';

/** メールテンプレートの差出・宛先情報を除いた本文部分 */
export interface ReservationConfirmationEmail {
  subject: string;
  text:    string;
  html:    string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReservationMailName(memberName: string): string {
  return memberName.trim() || '会員';
}

function reservationCode(r: Reservation): string {
  return r.reservationId.slice(0, 8).toUpperCase();
}

/**
 * 会員向け予約確認・キャンセル画面への URL を生成する。
 * FRONTEND_BASE_URL が不正・未設定のときは相対パスにフォールバックする。
 *
 * baseUrl は http(s) スキームの origin（scheme + host + port）であることを期待する。
 * パスやクエリを含む baseUrl、または javascript: などの非安全スキームが混入した場合は
 * 危険なリンクをメールに埋め込まないため、相対パスへ落とす。
 */
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
  // origin に余計な path/query/hash が付いている baseUrl は誤設定とみなす
  if (parsed.pathname !== '/' && parsed.pathname !== '') return path;
  if (parsed.search) return path;
  if (parsed.hash)   return path;

  return `${parsed.origin}${path}`;
}

/**
 * 予約確認メールの件名・本文・HTML を生成する純関数。
 * Resend への送信と切り離してテスト可能にする。
 */
export function buildReservationConfirmationEmail(
  r: Reservation,
  options: { frontendBaseUrl?: string } = {}
): ReservationConfirmationEmail {
  const code = reservationCode(r);
  const greetingName = getReservationMailName(r.memberName);
  const myReservationUrl = buildMyReservationUrl(code, options.frontendBaseUrl);
  const subject = `【Tri-force Koenji】施設予約を受け付けました（予約番号: ${code}）`;
  // 空白のみの備考は本文に出さない
  const remarks = r.remarks?.trim() ?? '';

  const textLines: string[] = [
    `${greetingName} 様`,
    '',
    '以下の内容で施設予約を受け付けました。',
    '',
    '━━━━━━━━━━━━━━━━',
    `予約番号: ${code}`,
    `施設名  : ${r.facilityName}`,
    `利用日  : ${r.date}`,
    `時間    : ${r.startTime} 〜 ${r.endTime}`,
    `参加人数: ${r.participants}名`,
    `利用目的: ${r.purpose}`,
  ];
  if (remarks) textLines.push(`備考    : ${remarks}`);
  textLines.push(
    '━━━━━━━━━━━━━━━━',
    '',
    '予約の確認・キャンセルはこちらから行えます（利用日当日まで可能）:',
    myReservationUrl,
    '※キャンセル時は予約番号と本メールの宛先アドレスの入力が必要です。',
    '',
    '管理者が会員確認後、予約を確定いたします。',
    '確定後に別途ご連絡する場合があります。',
    '',
    'Tri-force Koenji',
  );

  const details: [string, string][] = [
    ['予約番号', code],
    ['施設名',   r.facilityName],
    ['利用日',   r.date],
    ['時間',     `${r.startTime} 〜 ${r.endTime}`],
    ['参加人数', `${r.participants}名`],
    ['利用目的', r.purpose],
  ];
  if (remarks) details.push(['備考', remarks]);

  const detailRows = details
    .map(
      ([label, value]) => `
        <tr>
          <th style="padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</th>
          <td style="padding:8px 12px;color:#111827;word-break:break-all;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  // 可能な限りインラインCSSで組み、メーラーの互換性を確保する
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP',Meiryo,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f9fafb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background-color:#ffffff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:24px 32px 8px 32px;border-bottom:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#6b7280;letter-spacing:0.1em;">TRI-FORCE KOENJI</p>
              <h1 style="margin:4px 0 0 0;font-size:20px;color:#111827;">施設予約を受け付けました</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;">${escapeHtml(greetingName)} 様</p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;">以下の内容で施設予約を受け付けました。管理者が会員確認後、予約を確定いたします。</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background-color:#f9fafb;border-radius:6px;font-size:14px;margin:8px 0 20px 0;">
                ${detailRows}
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0 0;">
                <tr>
                  <td style="border-radius:6px;background-color:#2563eb;">
                    <a href="${escapeHtml(myReservationUrl)}" style="display:inline-block;padding:10px 20px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">予約の確認・キャンセル</a>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
                キャンセル時は予約番号 <strong style="font-family:monospace;color:#111827;">${escapeHtml(code)}</strong> と本メールの宛先アドレスの入力が必要です。利用日当日まで手続き可能です。
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
                リンクが開けない場合は以下のURLをブラウザに貼り付けてください:<br/>
                <span style="word-break:break-all;">${escapeHtml(myReservationUrl)}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px 32px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;line-height:1.6;">
              このメールは自動送信です。お心当たりのない場合はお手数ですが本メールを破棄してください。<br/>
              Tri-force Koenji
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    text: textLines.join('\n'),
    html,
  };
}
