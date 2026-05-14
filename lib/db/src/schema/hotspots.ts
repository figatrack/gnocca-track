import { pgTable, serial, real, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hotspotsTable = pgTable("hotspots", {
  id: serial("id").primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  intensity: text("intensity").notNull().default("low"),
  clickCount: integer("click_count").notNull().default(0),
  isSeed: boolean("is_seed").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  venueOsmId: text("venue_osm_id"),
  venueName: text("venue_name").notNull(),
  venueType: text("venue_type"),
  city: text("city").notNull().default(""),
  area: text("area"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const insertHotspotSchema = createInsertSchema(hotspotsTable).omit({ id: true, createdAt: true });
export type InsertHotspot = z.infer<typeof insertHotspotSchema>;
export type Hotspot = typeof hotspotsTable.$inferSelect;
