CREATE TABLE IF NOT EXISTS "abandoned_carts" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "address" text,
  "pincode" text,
  "source" text DEFAULT 'COD',
  "recovery_status" text DEFAULT 'New' NOT NULL,
  "event_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "abandoned_carts_phone_idx" ON "abandoned_carts" ("phone");
