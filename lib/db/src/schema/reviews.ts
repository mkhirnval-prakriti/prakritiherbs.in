import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  product: text("product").notNull().default("kamasutra-gold-plus"),
  reviewerName: text("reviewer_name").notNull(),
  phone: text("phone"),
  rating: integer("rating").notNull().default(5),
  reviewText: text("review_text").notNull(),
  status: text("status").notNull().default("pending"),
  source: text("source").notNull().default("manual"),
  verified: boolean("verified").default(false),
  city: text("city"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Review = typeof reviewsTable.$inferSelect;
