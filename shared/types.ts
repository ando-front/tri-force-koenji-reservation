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
  /** 会員セルフサービス照会用: email を trim + toLowerCase に正規化した値 */
  emailLower?: string;
  /** 会員セルフサービス照会用: 予約IDの先頭8文字を大文字化した値 */
  reservationCode?: string;
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
  /** リマインダーメール送信済みのタイムスタンプ。再送防止用 */
  reminderSentAt?: unknown;
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
  | 'reservation.deleted'
  | 'reservation.reminder_sent'
  | 'content.updated';

export interface AuditLog {
  logId: string;
  actor: string;
  action: AuditAction;
  targetId: string;
  payload: Record<string, unknown>;
  timestamp: unknown;
}

// ─── サイト文言（CMS） ────────────────────────────────────────────────────────

/** デフォルトの利用案内文言。Firestoreに値がないときのフォールバック。 */
export const DEFAULT_USAGE_GUIDE_CONTENT: UsageGuideContent = {
  reservationSteps: [
    '施設と日付を選択し、空き時間帯を確認します。',
    '表示されている予約者名を確認し、希望枠を選択します。',
    'ニックネーム（任意）、メールアドレス、参加人数、利用目的を入力して送信します。',
    '受付完了後、確認メールが届きます。',
  ],
  notes: [
    '各時間帯には入力したニックネームを公開表示します。未入力の場合は「会員1」形式の表示名になります。',
    'メンテナンス日と定休日は予約できません。空き枠が表示されない日は別日を選択してください。',
    '利用人数は実際の参加予定人数を入力してください。',
    '予約内容の確認や調整が必要な場合は、運営から連絡することがあります。',
  ],
};

export interface UsageGuideContent {
  reservationSteps: string[];
  notes: string[];
}

export interface UsageGuideContentDoc extends UsageGuideContent {
  updatedAt?: unknown;
  updatedBy?: string;
}

const ContentLineSchema = z
  .string()
  .trim()
  .min(1, '空行は登録できません')
  .max(500, '500文字以内で入力してください');

/** PUT /content/usage-guide リクエストボディ */
export const UpdateUsageGuideContentSchema = z.object({
  reservationSteps: z.array(ContentLineSchema).min(1, '最低1件は登録してください').max(20, '最大20件までです'),
  notes:            z.array(ContentLineSchema).min(0).max(20, '最大20件までです'),
});

export type UpdateUsageGuideContentInput = z.infer<typeof UpdateUsageGuideContentSchema>;

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

// ─── 会員向け予約照会・キャンセル ─────────────────────────────────────────────

/** 予約番号（予約IDの先頭8文字大文字）の正規表現 */
const ReservationCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{8}$/, '予約番号は8桁の英数字で入力してください');

/**
 * 会員照会用のメール正規化スキーマ。
 * 前後スペースを除去し、小文字化してから email バリデーションを行う。
 */
const NormalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('正しいメールアドレスを入力してください');

/** POST /reservations/lookup リクエストボディ */
export const LookupReservationSchema = z.object({
  reservationCode: ReservationCodeSchema,
  email:           NormalizedEmailSchema,
});

export type LookupReservationInput = z.infer<typeof LookupReservationSchema>;

/** POST /reservations/lookup/cancel リクエストボディ */
export const CancelReservationSchema = z.object({
  reservationCode: ReservationCodeSchema,
  email:           NormalizedEmailSchema,
  cancelReason:    z.string().max(500, '500文字以内で入力してください').optional().default(''),
});

export type CancelReservationInput = z.infer<typeof CancelReservationSchema>;

/** POST /reservations/lookup-by-email リクエストボディ */
export const LookupReservationsByEmailSchema = z.object({
  email: NormalizedEmailSchema,
});

export type LookupReservationsByEmailInput = z.infer<typeof LookupReservationsByEmailSchema>;

/** 会員向けに返却する予約情報（機微情報を除く） */
export interface PublicReservationView {
  reservationCode: string;
  memberName: string;
  facilityId: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: number;
  purpose: string;
  remarks: string;
  status: ReservationStatus;
  cancelledAt?: unknown;
  cancelReason?: string;
}

/**
 * メールアドレス検索の一覧表示用サマリ。
 * セキュリティ上、`reservationCode` や `purpose`/`remarks`/`memberName` 等は含めない。
 * これは `lookup-by-email` がメール所有のみで照会できるため、ここで予約番号を返してしまうと
 * その値を `lookup/cancel` に渡せて事実上「メール一発でキャンセル可能」になってしまう。
 * 詳細閲覧・キャンセルには別途予約番号の入力（`lookup` フロー）が必要。
 */
export interface PublicReservationSummary {
  facilityId: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: number;
  status: ReservationStatus;
}

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

/** 監査ログ一覧クエリパラメータ */
export interface ListAuditLogsQuery {
  action?: AuditAction;
  actor?: string;
  targetId?: string;
  limit?: number;
  cursor?: string;
}

// ─── 管理者ダッシュボード ─────────────────────────────────────────────────────

export interface DashboardTodayStats {
  date: string;                // "YYYY-MM-DD" (JST)
  pending: number;
  confirmed: number;
  cancelled: number;
  total: number;               // pending + confirmed （キャンセル除外）
}

export interface DashboardFacilityCount {
  facilityId: string;
  facilityName: string;
  count: number;               // 有効な予約数（pending + confirmed）
}

export interface DashboardUpcomingWeekStats {
  dateFrom: string;
  dateTo: string;
  total: number;
  byFacility: DashboardFacilityCount[];
}

export interface DashboardLast30DaysStats {
  dateFrom: string;
  dateTo: string;
  total: number;               // 全ステータス合計
  cancelled: number;
  cancellationRate: number;    // 0〜1、total=0 のときは 0
}

export interface DashboardTopMember {
  memberName: string;          // 未入力は「（未入力）」として集計
  count: number;
}

export interface DashboardStats {
  generatedAt: string;         // ISO8601
  today: DashboardTodayStats;
  upcomingWeek: DashboardUpcomingWeekStats;
  last30Days: DashboardLast30DaysStats;
  topMembers: DashboardTopMember[];
}
