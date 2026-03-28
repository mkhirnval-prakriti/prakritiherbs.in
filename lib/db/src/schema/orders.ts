import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address").notNull(),
  pincode: text("pincode").notNull(),
  quantity: integer("quantity").notNull(),
  product: text("product").notNull(),
  source: text("source").notNull().default("COD"),
  status: text("status").notNull().default("New"),
  paymentMethod: text("payment_method").default("COD"),
  paymentId: text("payment_id"),
  paymentStatus: text("payment_status").default("pending"),
  trackingId: text("tracking_id"),
  courier: text("courier"),
  city: text("city"),
  state: text("state"),
  visitorSource: text("visitor_source").default("Direct"),
  landingPageUrl: text("landing_page_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
