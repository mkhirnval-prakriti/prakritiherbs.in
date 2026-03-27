import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const adminDownloadsTable = pgTable("admin_downloads", {
  id: serial("id").primaryKey(),
  downloadedBy: text("downloaded_by").notNull().default("admin"),
  filename: text("filename").notNull(),
  recordCount: integer("record_count").notNull().default(0),
  filters: text("filters"),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
});

export type AdminDownload = typeof adminDownloadsTable.$inferSelect;
