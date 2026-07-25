'use server';

import { CancelReservationInputSchema } from '@tfk/core';
import { cancelReservation, reservations } from '@tfk/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getAppDb } from '@/lib/db';

/**
 * 会員によるキャンセル。設計書 7 章の既知トレードオフ:
 * 「メールアドレスを知っていれば第三者が予約番号を取得しキャンセルできる」は
 * 現行仕様を維持する（本人確認を強化するのはリアーキと独立した運用判断 — 第12章）。
 */
export async function cancelReservationAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = CancelReservationInputSchema.safeParse({
    reservationId: String(formData.get('reservationId') ?? ''),
    email: String(formData.get('email') ?? ''),
  });
  if (!parsed.success) return { error: '入力内容を確認してください' };

  const db = getAppDb();
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, parsed.data.reservationId),
  });
  if (!reservation || reservation.email !== parsed.data.email) {
    return { error: '予約が見つかりません（メールアドレスをご確認ください）' };
  }

  await cancelReservation(db, parsed.data.reservationId, 'member');
  revalidatePath('/my-reservation');
  return {};
}
