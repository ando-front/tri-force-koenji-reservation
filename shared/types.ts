import { z } from 'zod';

// ─── ユーティリティ ────────────────────────────────────────────────────────────

/** 今日の日付文字列 "YYYY-MM-DD" を返す */
function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── 施設 ─────────────────────────────────────────────────────────────────────

/** 曜日ごとの営業時間設定 */
export interface WeekdayHours {
  weekday: number;             // 0=日〜6=土
  openHour: number;            // 0-23
  closeHour: number;           // 1-24
  slotDurationMinutes?: number; // 省略時は施設デフォルトを使用
}

export interface Facility {
  facilityId: string;
  name: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  slotDurationMinutes: number;
  closedWeekdays: number[]; // 0=日〜6=土
  maintenanceDates: string[];
  weekdayHours?: WeekdayHours[]; // 曜日ごとの営業時間（省略時は共通設定を使用）
  isActive: boolean;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
}

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD 形式で入力してください');

const WeekdayHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  openHour: z.number().int().min(0, '開始時刻が不正です').max(23, '開始時刻が不正です'),
  closeHour: z.number().int().min(1, '終了時刻が不正です').max(24, '終了時刻が不正です'),
  slotDurationMinutes: z
    .number()
    .int()
    .min(15, '枠時間は15分以上で入力してください')
    .max(180, '枠時間は180分以下で入力してください')
    .optional(),
}).refine((v) => v.closeHour > v.openHour, {
  message: '終了時刻は開始時刻より後にしてください',
  path: ['closeHour'],
});

const FacilityFormBaseSchema = z.object({
  facilityId: z
    .string()
    .min(1, '施設IDは必須です')
    .max(50, '施設IDは50文字以内で入力してください')
    .regex(/^[a-z0-9-]+$/, '施設IDは半角英小文字・数字・ハイフンのみ使えます'),
  name: z.string().min(1, '施設名は必須です').max(100, '施設名は100文字以内で入力してください'),
  capacity: z.number().int().min(1, '定員は1以上で入力してください').max(500, '定員が大きすぎます'),
  openHour: z.number().int().min(0, '開始時刻が不正です').max(23, '開始時刻が不正です'),
  closeHour: z.number().int().min(1, '終了時刻が不正です').max(24, '終了時刻が不正です'),
  slotDurationMinutes: z
    .number()
    .int()
    .min(15, '枠時間は15分以上で入力してください')
    .max(180, '枠時間は180分以下で入力してください'),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  maintenanceDates: z.array(DateStringSchema).default([]),
  weekdayHours: z.array(WeekdayHoursSchema).default([]),
  isActive: z.boolean().default(true),
});

export const FacilityFormSchema = FacilityFormBaseSchema.refine((value) => value.closeHour > value.openHour, {
  message: '終了時刻は開始時刻より後にしてください',
  path: ['closeHour'],
});

export const CreateFacilitySchema = FacilityFormSchema;
export type CreateFacilityInput = z.infer<typeof CreateFacilitySchema>;

export const UpdateFacilitySchema = FacilityFormBaseSchema
  .omit({ facilityId: true })
  .refine((value) => value.closeHour > value.openHour, {
    message: '終了時刻は開始時刻より後にしてください',
    path: ['closeHour'],
  });
export type UpdateFacilityInput = z.infer<typeof UpdateFacilitySchema>;

// ─── 予約ステータス ───────────────────────────────────────────────────────────

export const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

// ─── 予約 ─────────────────────────────────────────────────────────────────────

export interface Reservation {
  reservationId: string;
  memberName: string;
  email: string;
  facilityId: string;
  facilityName: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  purpose: string;
  participants: number;
  remarks: string;
  status: ReservationStatus;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
  cancelledAt?: unknown;
  cancelReason?: string;
}

// ─── 管理者 ────────────────────────────────────────────────────────────────────

export interface Admin {
  uid: string;
  email: string;
  displayName: string;
  createdAt: unknown;
}

// ─── 監査ログ ──────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'reservation.created'
  | 'reservation.confirmed'
  | 'reservation.cancelled'
  | 'reservation.deleted';

export interface AuditLog {
  logId: string;
  actor: string;
  action: AuditAction;
  targetId: string;
  payload: Record<string, unknown>;
  timestamp: unknown;
}

// ─── APIリクエスト・レスポンス型 ───────────────────────────────────────────────

/** POST /reservations リクエストボディのスキーマ */
export const CreateReservationSchema = z.object({
  memberName:   z.string().trim().max(50, '50文字以内で入力してください').optional().default(''),
  email:        z.string().email('正しいメールアドレスを入力してください'),
  facilityId:   z.string().min(1, '施設を選択してください'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません')
    .refine((d: string) => d >= todayString(), '過去の日付は選択できません')
    .refine((d: string) => {
      const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return diff <= 90;
    }, '90日以上先の予約はできません'),
  startTime:    z.string().regex(/^\d{2}:\d{2}$/, '時刻の形式が正しくありません'),
  participants: z
    .number({ invalid_type_error: '参加人数を入力してください' })
    .int()
    .min(1, '1名以上を入力してください')
    .max(100, '参加人数が多すぎます'),
  purpose:      z.string().min(1, '利用目的は必須です').max(200, '200文字以内で入力してください'),
  remarks:      z.string().max(500, '500文字以内で入力してください').optional().default(''),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

/** POST /reservations 成功レスポンス */
export interface CreateReservationResponse {
  success: true;
  reservationId: string;
  message: string;
}

/** PATCH /admin/reservations/:id/status リクエストボディ */
export const UpdateStatusSchema = z.object({
  status:       z.enum(['confirmed', 'cancelled']),
  cancelReason: z.string().max(500).optional().default(''),
});

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

/** GET /availability レスポンスの各スロット */
export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  available: boolean;
  currentCount: number;
  capacity: number;
  reservedNames: string[];
}

/** GET /availability レスポンス */
export interface AvailabilityResponse {
  facilityId: string;
  facilityName: string;
  date: string;
  slots: AvailabilitySlot[];
}

/** 共通エラーレスポンス */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/** 予約一覧クエリパラメータ */
export interface ListReservationsQuery {
  status?: ReservationStatus;
  facilityId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string; // Firestoreページネーションカーソル（base64エンコード）
}
