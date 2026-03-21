import { z } from 'zod';

// ─── ユーティリティ ────────────────────────────────────────────────────────────

/** 今日の日付文字列 "YYYY-MM-DD" を返す */
function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── 施設 ─────────────────────────────────────────────────────────────────────

export interface Facility {
  facilityId: string;
  name: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  slotDurationMinutes: number;
  closedWeekdays: number[]; // 0=日〜6=土
  isActive: boolean;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
}

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
  memberName:   z.string().min(1, 'お名前は必須です').max(50, '50文字以内で入力してください'),
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
