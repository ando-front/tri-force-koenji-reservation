'use server';

import { CreateFacilityInputSchema } from '@tfk/core';
import { createFacility } from '@tfk/db';
import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/auth';
import { getAppDb } from '@/lib/db';

/**
 * 施設作成。B-6 の根治: 旧実装は console.log のみで監査ログに残らなかった変更を、
 * 同一トランザクションで reservation_events へ書き込む（@tfk/db の createFacility 内）。
 */
export async function createFacilityAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdminUser();
  if (!admin) return { error: '権限がありません' };

  const parsed = CreateFacilityInputSchema.safeParse({
    id: String(formData.get('id') ?? ''),
    name: String(formData.get('name') ?? ''),
    capacity: Number(formData.get('capacity')),
    openHour: Number(formData.get('openHour')),
    closeHour: Number(formData.get('closeHour')),
    slotDurationMinutes: Number(formData.get('slotDurationMinutes') || 60),
    closedWeekdays: [],
    maintenanceDates: [],
    weekdayHours: [],
    blockedPeriods: [],
    isActive: true,
  });
  if (!parsed.success) return { error: '入力内容を確認してください' };

  const db = getAppDb();
  await createFacility(db, parsed.data, admin.email);
  revalidatePath('/admin/facilities');
  return {};
}
