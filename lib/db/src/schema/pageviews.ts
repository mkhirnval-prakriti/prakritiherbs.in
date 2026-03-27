import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const pageViewsTable = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().default("/"),
  sessionId: text("session_id"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyVisitorStatsTable = pgTable("daily_visitor_stats", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  visitors: integer("visitors").notNull().default(0),
  pageViews: integer("page_views").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PageView = typeof pageViewsTable.$inferSelect;
