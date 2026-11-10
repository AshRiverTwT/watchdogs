import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------- auth

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always stored lower-cased and trimmed. */
    email: text("email").notNull(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("user"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token; the raw token is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const emailTokenKind = pgEnum("email_token_kind", ["verify", "reset", "unsubscribe", "pause"]);

export const emailTokens = pgTable(
  "email_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: emailTokenKind("kind").notNull(),
    /** SHA-256 of the token in the link. */
    tokenHash: text("token_hash").notNull(),
    /** For pause links: which alert. */
    alertId: uuid("alert_id").references((): AnyPgColumn => alerts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("email_tokens_hash_key").on(t.tokenHash),
    index("email_tokens_user_kind_idx").on(t.userId, t.kind),
  ],
);

export const userPrefs = pgTable("user_prefs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Master switch, turned off by the unsubscribe link. */
  emailAlerts: boolean("email_alerts").notNull().default(true),
  /** Group several matches found in one cycle into one email. */
  digest: boolean("digest").notNull().default(true),
  updatedAt: updatedAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    subject: text("subject"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(sql`${t.createdAt} desc`)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type EmailTokenKind = (typeof emailTokenKind.enumValues)[number];

// ---------------------------------------------------------------- catalog

export const formats = pgTable(
  "formats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable slug, e.g. "2d", "dolby-3d". */
    code: text("code").notNull(),
    name: text("name").notNull(),
    /**
     * Labels as BMS prints them on the showtimes page ("2D", "DOLBY 3D", "PCX 2D"...),
     * upper-cased. Used to map scraped shows to a format.
     */
    bmsLabels: text("bms_labels").array().notNull().default(sql`'{}'::text[]`),
    sortOrder: integer("sort_order").notNull().default(100),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("formats_code_key").on(t.code)],
);

export const placeKind = pgEnum("place_kind", ["city", "area"]);

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Areas point at their city; cities have no parent. */
    parentId: uuid("parent_id").references((): AnyPgColumn => places.id, { onDelete: "restrict" }),
    kind: placeKind("kind").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** BMS region code on city rows, e.g. "HYD". */
    bmsRegionCode: text("bms_region_code"),
    /** BMS region slug used in URLs, e.g. "hyderabad". */
    bmsRegionSlug: text("bms_region_slug"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("places_slug_key").on(t.slug),
    index("places_parent_idx").on(t.parentId),
    check("places_city_has_no_parent", sql`(${t.kind} = 'city') = (${t.parentId} is null)`),
  ],
);

export const theatres = pgTable(
  "theatres",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The area the theatre is in. */
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** BMS venue code (e.g. "PVHB"); null until someone looks it up. */
    bmsVenueCode: text("bms_venue_code"),
    address: text("address"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("theatres_slug_key").on(t.slug),
    uniqueIndex("theatres_bms_venue_code_key").on(t.bmsVenueCode),
    index("theatres_place_idx").on(t.placeId),
  ],
);

/** Which formats a theatre can screen; drives the format-vs-theatre warning on alerts. */
export const theatreFormats = pgTable(
  "theatre_formats",
  {
    theatreId: uuid("theatre_id")
      .notNull()
      .references(() => theatres.id, { onDelete: "cascade" }),
    formatId: uuid("format_id")
      .notNull()
      .references(() => formats.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.theatreId, t.formatId] }), index("theatre_formats_format_idx").on(t.formatId)],
);

export const movieStatus = pgEnum("movie_status", ["upcoming", "now_showing", "archived"]);

export const movies = pgTable(
  "movies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    synopsis: text("synopsis"),
    /** Original language, e.g. "Telugu". Per-language variants live in movie_bms_events. */
    language: text("language"),
    certificate: text("certificate"),
    runtimeMin: integer("runtime_min"),
    releaseDate: date("release_date"),
    /** Path under /uploads/posters, set by the admin poster upload. */
    posterPath: text("poster_path"),
    status: movieStatus("status").notNull().default("upcoming"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("movies_slug_key").on(t.slug), index("movies_status_idx").on(t.status)],
);

/** BMS uses a separate ET… event code per language/format variant of one film. */
export const movieBmsEvents = pgTable(
  "movie_bms_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    eventCode: text("event_code").notNull(),
    /** BMS URL slug for the event, e.g. "kalki-2898-ad". */
    bmsSlug: text("bms_slug"),
    language: text("language").notNull(),
    /** Free text such as "3D" or "IMAX 2D" when BMS splits variants by format. */
    formatHint: text("format_hint"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("movie_bms_events_code_key").on(t.eventCode), index("movie_bms_events_movie_idx").on(t.movieId)],
);

export type Format = typeof formats.$inferSelect;
export type Place = typeof places.$inferSelect;
export type Theatre = typeof theatres.$inferSelect;
export type Movie = typeof movies.$inferSelect;
export type MovieBmsEvent = typeof movieBmsEvents.$inferSelect;

// ---------------------------------------------------------------- alerts

export const alertStatus = pgEnum("alert_status", ["active", "paused", "fulfilled", "expired"]);
export const alertMode = pgEnum("alert_mode", ["first_match", "keep_watching"]);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "restrict" }),
    /** The city whose BMS region is polled. */
    cityId: uuid("city_id")
      .notNull()
      .references(() => places.id, { onDelete: "restrict" }),
    /** IST calendar dates, sorted; date ranges are expanded on save. */
    dates: date("dates").array().notNull(),
    /** IST wall-clock window, inclusive. */
    timeStart: time("time_start").notNull(),
    timeEnd: time("time_end").notNull(),
    mode: alertMode("mode").notNull().default("first_match"),
    status: alertStatus("status").notNull().default("active"),
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
    /** Soft delete keeps notification history; deleted alerts are never matched. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("alerts_user_idx").on(t.userId),
    index("alerts_status_idx").on(t.status).where(sql`${t.deletedAt} is null`),
    check("alerts_time_window", sql`${t.timeStart} < ${t.timeEnd}`),
    check("alerts_has_dates", sql`cardinality(${t.dates}) > 0`),
  ],
);

/** Specific BMS variants (language/format). None means any variant of the movie. */
export const alertEvents = pgTable(
  "alert_events",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => movieBmsEvents.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.alertId, t.eventId] })],
);

/** None means any format. */
export const alertFormats = pgTable(
  "alert_formats",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    formatId: uuid("format_id")
      .notNull()
      .references(() => formats.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.alertId, t.formatId] })],
);

/** Theatres and areas together: a show matches if its theatre is listed or sits in a listed area. Both empty means anywhere in the city. */
export const alertTheatres = pgTable(
  "alert_theatres",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    theatreId: uuid("theatre_id")
      .notNull()
      .references(() => theatres.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.alertId, t.theatreId] }), index("alert_theatres_theatre_idx").on(t.theatreId)],
);

export const alertPlaces = pgTable(
  "alert_places",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.alertId, t.placeId] })],
);

export const alertHistoryKind = pgEnum("alert_history_kind", [
  "created",
  "edited",
  "paused",
  "resumed",
  "fulfilled",
  "expired",
  "deleted",
  "matched",
]);

export const alertHistory = pgTable(
  "alert_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    kind: alertHistoryKind("kind").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("alert_history_alert_idx").on(t.alertId, t.createdAt)],
);

export type Alert = typeof alerts.$inferSelect;
export type AlertStatus = (typeof alertStatus.enumValues)[number];
export type AlertHistoryKind = (typeof alertHistoryKind.enumValues)[number];
