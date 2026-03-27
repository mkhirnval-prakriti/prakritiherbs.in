ALTER TABLE orders ADD COLUMN IF NOT EXISTS visitor_source text DEFAULT 'Direct';
CREATE INDEX IF NOT EXISTS "orders_visitor_source_idx" ON "orders" ("visitor_source");
