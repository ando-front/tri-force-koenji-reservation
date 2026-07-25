import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// packages/db/schema.ts — 単一の源（設計書 6.5）。
// スキーマを編集 → `pnpm db:generate` でマイグレーション SQL を生成 → PR レビュー →
// main マージで `drizzle-kit migrate` を実行する運用に統一する。

export const reservationStatusEnum = pgEnum('reservation_status', [
  'pending',
  'confirmed',
  'cancelled',
]);
export const auditActionEnum = pgEnum('audit_action', [
  'reservation.created',
  'reservation.confirmed',
  'reservation.cancelled',
  'reservation.deleted',
  'facility.created',
  'facility.updated',
  'content.updated',
]);

export const facilities = pgTable('facilities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  openHour: integer('open_hour').notNull(),
  closeHour: integer('close_hour').notNull(),
  slotDurationMinutes: integer('slot_duration_minutes').notNull().default(60),
  closedWeekdays: integer('closed_weekdays').array().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const facilityWeekdayHours = pgTable(
  'facility_weekday_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: text('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(), // 0=日曜 .. 6=土曜
    openHour: integer('open_hour').notNull(),
    closeHour: integer('close_hour').notNull(),
    slotDurationMinutes: integer('slot_duration_minutes'),
  },
  (t) => [unique('uniq_facility_weekday').on(t.facilityId, t.weekday)],
);

export const facilityClosures = pgTable(
  'facility_closures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: text('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    closedOn: text('closed_on').notNull(), // "YYYY-MM-DD"（休館日はカレンダー日でよい）
    reason: text('reason'),
  },
  (t) => [unique('uniq_facility_closure').on(t.facilityId, t.closedOn)],
);

export const facilityBlockedPeriods = pgTable('facility_blocked_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  facilityId: text('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  startTime: text('start_time').notNull(), // "HH:MM"
  endTime: text('end_time').notNull(),
  weekdays: integer('weekdays').array(),
  dates: text('dates').array(), // "YYYY-MM-DD"[]
});

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: text('facility_id')
      .notNull()
      .references(() => facilities.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    memberName: text('member_name').notNull().default(''),
    email: text('email').notNull(),
    participants: integer('participants').notNull(),
    purpose: text('purpose').notNull(),
    remarks: text('remarks').notNull().default(''),
    status: reservationStatusEnum('status').notNull().default('confirmed'),
    idempotencyKey: uuid('idempotency_key').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // B-5: 二重送信を DB で弾く。同一施設・同一冪等キーの再送は新規作成させない。
    unique('uniq_idempotency').on(t.facilityId, t.idempotencyKey),
    check('participants_positive', sql`${t.participants} > 0`),
  ],
);

/**
 * 定員制御の中核（設計書 6.2 / B-1 の根治）。
 *
 * `CHECK` は他テーブルを参照できないため、施設定員のスナップショットを
 * 同テーブルに持つ。予約作成は `slot_occupancy` への
 * `INSERT ... ON CONFLICT DO UPDATE` で行ロックを取り、直列化された上で
 * `within_capacity` 制約（23514）が定員超過を弾く。10並列でも定員を超えないことを
 * ローカル Postgres で実測済み（設計書 付録 C-3）。
 */
export const slotOccupancy = pgTable(
  'slot_occupancy',
  {
    facilityId: text('facility_id')
      .notNull()
      .references(() => facilities.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    capacitySnapshot: integer('capacity_snapshot').notNull(),
    participantsTotal: integer('participants_total').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.facilityId, t.startsAt] }),
    check('capacity_snapshot_positive', sql`${t.capacitySnapshot} > 0`),
    check('within_capacity', sql`${t.participantsTotal} <= ${t.capacitySnapshot}`),
  ],
);

export const reservationEvents = pgTable('reservation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
  action: auditActionEnum('action').notNull(),
  actor: text('actor').notNull(),
  targetId: text('target_id').notNull(),
  payload: jsonb('payload').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').notNull().unique(), // Supabase Auth の auth.users.id
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const siteContent = pgTable('site_content', {
  key: text('key').primaryKey(), // 例: "usage-guide"
  content: jsonb('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').notNull().default(''),
});
