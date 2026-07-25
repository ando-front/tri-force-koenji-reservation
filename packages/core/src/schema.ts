import { z } from 'zod';
import { todayJst } from './time';

// packages/core は DB もフレームワークも知らない（設計書 5.3/5.4）。
// 旧 shared/types.ts のバリデーションルールをそのまま移植し、
// timestamptz ベースのフィールド名（starts_at 相当）に合わせて調整する。

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD 形式で入力してください');

export const TimeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, '時刻は HH:MM 形式で入力してください');

/** 予約作成フォームの入力スキーマ（Server Action の第一段階の検証）。 */
export const CreateReservationInputSchema = z.object({
  memberName: z.string().trim().max(50, '50文字以内で入力してください').optional().default(''),
  email: z.string().trim().toLowerCase().email('正しいメールアドレスを入力してください'),
  facilityId: z.string().min(1, '施設を選択してください'),
  date: DateStringSchema.refine((d) => d >= todayJst(), '過去の日付は選択できません').refine(
    (d) => {
      const diffDays =
        (new Date(`${d}T00:00:00Z`).getTime() - new Date(`${todayJst()}T00:00:00Z`).getTime()) /
        86_400_000;
      return diffDays <= 90;
    },
    '90日以上先の予約はできません',
  ),
  startTime: TimeStringSchema,
  participants: z
    .number({ invalid_type_error: '参加人数を入力してください' })
    .int()
    .min(1, '1名以上を入力してください')
    .max(100, '参加人数が多すぎます'),
  purpose: z.string().min(1, '利用目的は必須です').max(200, '200文字以内で入力してください'),
  remarks: z.string().max(500, '500文字以内で入力してください').optional().default(''),
  // B-5: Server Action がリクエストごとに UUID を発行し hidden field に埋める。
  // 連打・リトライ・ネットワーク再送でも同じキーが飛ぶため、二重送信は DB の
  // UNIQUE(facility_id, idempotency_key) 制約で構造的に弾かれる。
  idempotencyKey: z.string().uuid(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationInputSchema>;

export const CancelReservationInputSchema = z.object({
  reservationId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email('正しいメールアドレスを入力してください'),
});
export type CancelReservationInput = z.infer<typeof CancelReservationInputSchema>;

export const LookupReservationsByEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('正しいメールアドレスを入力してください'),
});
export type LookupReservationsByEmailInput = z.infer<typeof LookupReservationsByEmailSchema>;

const WeekdayHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  openHour: z.number().int().min(0, '開始時刻が不正です').max(23, '開始時刻が不正です'),
  closeHour: z.number().int().min(1, '終了時刻が不正です').max(24, '終了時刻が不正です'),
  slotDurationMinutes: z.number().int().min(5).max(480).optional(),
});

const BlockedPeriodSchema = z.object({
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  dates: z.array(DateStringSchema).optional(),
});

export const CreateFacilityInputSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'IDは半角英数字とハイフンのみです'),
  name: z.string().min(1, '施設名は必須です').max(100, '施設名は100文字以内で入力してください'),
  capacity: z.number().int().min(1, '定員は1以上で入力してください').max(500, '定員が大きすぎます'),
  openHour: z.number().int().min(0, '開始時刻が不正です').max(23, '開始時刻が不正です'),
  closeHour: z.number().int().min(1, '終了時刻が不正です').max(24, '終了時刻が不正です'),
  slotDurationMinutes: z.number().int().min(5).max(480).default(60),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  maintenanceDates: z.array(DateStringSchema).default([]),
  weekdayHours: z.array(WeekdayHoursSchema).default([]),
  blockedPeriods: z.array(BlockedPeriodSchema).default([]),
  isActive: z.boolean().default(true),
});
export type CreateFacilityInput = z.infer<typeof CreateFacilityInputSchema>;

export const UpdateFacilityInputSchema = CreateFacilityInputSchema.omit({ id: true }).partial();
export type UpdateFacilityInput = z.infer<typeof UpdateFacilityInputSchema>;

export interface Facility {
  id: string;
  name: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  slotDurationMinutes: number;
  closedWeekdays: number[];
  maintenanceDates: string[];
  weekdayHours: Array<{
    weekday: number;
    openHour: number;
    closeHour: number;
    slotDurationMinutes?: number;
  }>;
  blockedPeriods: Array<{
    startTime: string;
    endTime: string;
    weekdays?: number[];
    dates?: string[];
  }>;
  isActive: boolean;
}
