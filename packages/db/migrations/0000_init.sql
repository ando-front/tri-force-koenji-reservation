CREATE TYPE "public"."audit_action" AS ENUM('reservation.created', 'reservation.confirmed', 'reservation.cancelled', 'reservation.deleted', 'facility.created', 'facility.updated', 'content.updated');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"capacity" integer NOT NULL,
	"open_hour" integer NOT NULL,
	"close_hour" integer NOT NULL,
	"slot_duration_minutes" integer DEFAULT 60 NOT NULL,
	"closed_weekdays" integer[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_blocked_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"weekdays" integer[],
	"dates" text[]
);
--> statement-breakpoint
CREATE TABLE "facility_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" text NOT NULL,
	"closed_on" text NOT NULL,
	"reason" text,
	CONSTRAINT "uniq_facility_closure" UNIQUE("facility_id","closed_on")
);
--> statement-breakpoint
CREATE TABLE "facility_weekday_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"open_hour" integer NOT NULL,
	"close_hour" integer NOT NULL,
	"slot_duration_minutes" integer,
	CONSTRAINT "uniq_facility_weekday" UNIQUE("facility_id","weekday")
);
--> statement-breakpoint
CREATE TABLE "reservation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"action" "audit_action" NOT NULL,
	"actor" text NOT NULL,
	"target_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"member_name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"participants" integer NOT NULL,
	"purpose" text NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"status" "reservation_status" DEFAULT 'confirmed' NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_idempotency" UNIQUE("facility_id","idempotency_key"),
	CONSTRAINT "participants_positive" CHECK ("reservations"."participants" > 0)
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"key" text PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_occupancy" (
	"facility_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"capacity_snapshot" integer NOT NULL,
	"participants_total" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "slot_occupancy_facility_id_starts_at_pk" PRIMARY KEY("facility_id","starts_at"),
	CONSTRAINT "capacity_snapshot_positive" CHECK ("slot_occupancy"."capacity_snapshot" > 0),
	CONSTRAINT "within_capacity" CHECK ("slot_occupancy"."participants_total" <= "slot_occupancy"."capacity_snapshot")
);
--> statement-breakpoint
ALTER TABLE "facility_blocked_periods" ADD CONSTRAINT "facility_blocked_periods_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_closures" ADD CONSTRAINT "facility_closures_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_weekday_hours" ADD CONSTRAINT "facility_weekday_hours_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_occupancy" ADD CONSTRAINT "slot_occupancy_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;