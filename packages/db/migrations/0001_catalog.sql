CREATE TYPE "public"."movie_status" AS ENUM('upcoming', 'now_showing', 'archived');--> statement-breakpoint
CREATE TYPE "public"."place_kind" AS ENUM('city', 'area');--> statement-breakpoint
CREATE TABLE "formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"bms_labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_bms_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"event_code" text NOT NULL,
	"bms_slug" text,
	"language" text NOT NULL,
	"format_hint" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"synopsis" text,
	"language" text,
	"certificate" text,
	"runtime_min" integer,
	"release_date" date,
	"poster_path" text,
	"status" "movie_status" DEFAULT 'upcoming' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"kind" "place_kind" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"bms_region_code" text,
	"bms_region_slug" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_city_has_no_parent" CHECK (("places"."kind" = 'city') = ("places"."parent_id" is null))
);
--> statement-breakpoint
CREATE TABLE "theatre_formats" (
	"theatre_id" uuid NOT NULL,
	"format_id" uuid NOT NULL,
	CONSTRAINT "theatre_formats_theatre_id_format_id_pk" PRIMARY KEY("theatre_id","format_id")
);
--> statement-breakpoint
CREATE TABLE "theatres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"bms_venue_code" text,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movie_bms_events" ADD CONSTRAINT "movie_bms_events_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_parent_id_places_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theatre_formats" ADD CONSTRAINT "theatre_formats_theatre_id_theatres_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."theatres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theatre_formats" ADD CONSTRAINT "theatre_formats_format_id_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."formats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theatres" ADD CONSTRAINT "theatres_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "formats_code_key" ON "formats" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "movie_bms_events_code_key" ON "movie_bms_events" USING btree ("event_code");--> statement-breakpoint
CREATE INDEX "movie_bms_events_movie_idx" ON "movie_bms_events" USING btree ("movie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movies_slug_key" ON "movies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "movies_status_idx" ON "movies" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_key" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "places_parent_idx" ON "places" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "theatre_formats_format_idx" ON "theatre_formats" USING btree ("format_id");--> statement-breakpoint
CREATE UNIQUE INDEX "theatres_slug_key" ON "theatres" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "theatres_bms_venue_code_key" ON "theatres" USING btree ("bms_venue_code");--> statement-breakpoint
CREATE INDEX "theatres_place_idx" ON "theatres" USING btree ("place_id");