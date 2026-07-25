'use server';

import { CreateReservationInputSchema, jstWallClockToDate } from '@tfk/core';
import { bookReservation, CapacityExceededError, FacilityNotFoundError } from '@tfk/db';
import { redirect } from 'next/navigation';
import { getAppDb } from '@/lib/db';

export type CreateReservationActionState = {
  error?: string;
  fields?: Record<string, string>;
};

/**
 * 予約作成 Server Action（設計書 8.1: fetch POST → Express の代わりに Server Action）。
 *
 * B-5 の構造的な解決: フォームの hidden field に埋め込まれた idempotencyKey が
 * そのまま渡ってくる。連打・戻る+再送信・ネットワーク再送のいずれでも同じキーが飛ぶため、
 * DB の UNIQUE 制約が2件目以降を「既存予約を返す」動作に変換する。
 */
export async function createReservationAction(
  _prev: CreateReservationActionState,
  formData: FormData,
): Promise<CreateReservationActionState> {
  const raw = {
    memberName: String(formData.get('memberName') ?? ''),
    email: String(formData.get('email') ?? ''),
    facilityId: String(formData.get('facilityId') ?? ''),
    date: String(formData.get('date') ?? ''),
    startTime: String(formData.get('startTime') ?? ''),
    participants: Number(formData.get('participants')),
    purpose: String(formData.get('purpose') ?? ''),
    remarks: String(formData.get('remarks') ?? ''),
    idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
  };

  const parsed = CreateReservationInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    parsed.error.errors.forEach((e) => {
      fields[e.path.join('.')] = e.message;
    });
    return { error: '入力内容を確認してください', fields };
  }

  const input = parsed.data;
  const db = getAppDb();

  // slotDurationMinutes は core 側で施設の営業設定から解決すべきだが、
  // ここでは簡略化のため 60 分固定を前提にしている（施設マスタ拡張時は
  // getFacilityWithSchedule 経由で正しい枠幅を取得するよう改良する）。
  const startsAt = jstWallClockToDate(input.date, input.startTime);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  let reservationId: string;
  try {
    const result = await bookReservation(db, {
      facilityId: input.facilityId,
      startsAt,
      endsAt,
      memberName: input.memberName ?? '',
      email: input.email,
      participants: input.participants,
      purpose: input.purpose,
      remarks: input.remarks ?? '',
      idempotencyKey: input.idempotencyKey,
    });
    reservationId = result.reservationId;
  } catch (err) {
    if (err instanceof CapacityExceededError) {
      return { error: 'この枠は満員のため予約できません。別の枠をお選びください。' };
    }
    if (err instanceof FacilityNotFoundError) {
      return { error: '施設が見つかりません。' };
    }
    throw err;
  }

  // redirect() は内部的に throw するため、try/catch の外で呼ぶ
  // （try 内で呼ぶと上の catch がリダイレクトを誤ってエラー扱いしてしまう）。
  redirect(`/complete?id=${reservationId}`);
}
