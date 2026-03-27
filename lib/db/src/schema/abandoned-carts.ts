import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const abandonedCartsTable = pgTable("abandoned_carts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  pincode: text("pincode"),
  source: text("source").default("COD"),
  recoveryStatus: text("recovery_status").notNull().default("New"),
  eventId: text("event_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AbandonedCart = typeof abandonedCartsTable.$inferSelect;
