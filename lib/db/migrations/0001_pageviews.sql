CREATE TABLE IF NOT EXISTS "page_views" (
  "id" serial PRIMARY KEY NOT NULL,
  "path" text DEFAULT '/' NOT NULL,
  "session_id" text,
  "referrer" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "daily_visitor_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "date" text NOT NULL,
  "visitors" integer DEFAULT 0 NOT NULL,
  "page_views" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "daily_visitor_stats_date_unique" UNIQUE("date")
);
