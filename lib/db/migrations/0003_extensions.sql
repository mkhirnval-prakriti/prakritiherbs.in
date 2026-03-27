ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'COD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier text;

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "product" text NOT NULL DEFAULT 'kamasutra-gold-plus',
  "reviewer_name" text NOT NULL,
  "phone" text,
  "rating" integer NOT NULL DEFAULT 5,
  "review_text" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "source" text NOT NULL DEFAULT 'manual',
  "verified" boolean DEFAULT false,
  "city" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews" ("status");
CREATE INDEX IF NOT EXISTS "reviews_product_idx" ON "reviews" ("product");
