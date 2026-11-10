CREATE TYPE "public"."alert_history_kind" AS ENUM('created', 'edited', 'paused', 'resumed', 'fulfilled', 'expired', 'deleted', 'matched');--> statement-breakpoint
CREATE TYPE "public"."alert_mode" AS ENUM('first_match', 'keep_watching');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'paused', 'fulfilled', 'expired');--> statement-breakpoint
CREATE TABLE "alert_events" (
	"alert_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	CONSTRAINT "alert_events_alert_id_event_id_pk" PRIMARY KEY("alert_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "alert_formats" (
	"alert_id" uuid NOT NULL,
	"format_id" uuid NOT NULL,
	CONSTRAINT "alert_formats_alert_id_format_id_pk" PRIMARY KEY("alert_id","format_id")
);
--> statement-breakpoint
CREATE TABLE "alert_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"kind" "alert_history_kind" NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_places" (
	"alert_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	CONSTRAINT "alert_places_alert_id_place_id_pk" PRIMARY KEY("alert_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "alert_theatres" (
	"alert_id" uuid NOT NULL,
	"theatre_id" uuid NOT NULL,
	CONSTRAINT "alert_theatres_alert_id_theatre_id_pk" PRIMARY KEY("alert_id","theatre_id")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"dates" date[] NOT NULL,
	"time_start" time NOT NULL,
	"time_end" time NOT NULL,
	"mode" "alert_mode" DEFAULT 'first_match' NOT NULL,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"last_matched_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_time_window" CHECK ("alerts"."time_start" < "alerts"."time_end"),
	CONSTRAINT "alerts_has_dates" CHECK (cardinality("alerts"."dates") > 0)
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_event_id_movie_bms_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."movie_bms_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_formats" ADD CONSTRAINT "alert_formats_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_formats" ADD CONSTRAINT "alert_formats_format_id_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."formats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_places" ADD CONSTRAINT "alert_places_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_places" ADD CONSTRAINT "alert_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_theatres" ADD CONSTRAINT "alert_theatres_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_theatres" ADD CONSTRAINT "alert_theatres_theatre_id_theatres_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."theatres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_city_id_places_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_history_alert_idx" ON "alert_history" USING btree ("alert_id","created_at");--> statement-breakpoint
CREATE INDEX "alert_theatres_theatre_idx" ON "alert_theatres" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "alerts_user_idx" ON "alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status") WHERE "alerts"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;