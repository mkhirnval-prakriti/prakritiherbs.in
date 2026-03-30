import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const leadTrackingTable = pgTable("lead_tracking", {
  id: serial("id").primaryKey(),
  eventId: text("event_id"),
  type: text("type").notNull(),
  source: text("source").notNull().default("direct"),
  customerPhone: text("customer_phone"),
  callStatus: text("call_status").notNull().default("clicked"),
  callDuration: integer("call_duration"),
  pageUrl: text("page_url"),
  landingPage: text("landing_page"),
  campaignName: text("campaign_name"),
  adsetName: text("adset_name"),
  adName: text("ad_name"),
  deviceType: text("device_type"),
  browser: text("browser"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  city: text("city"),
  state: text("state"),
  country: text("country").default("India"),
  website: text("website"),
  domain: text("domain"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LeadTracking = typeof leadTrackingTable.$inferSelect;
