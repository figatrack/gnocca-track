import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hotspotsTable } from "./hotspots";

export const clicksTable = pgTable("clicks", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  hotspotId: integer("hotspot_id").notNull().references(() => hotspotsTable.id, { onDelete: "cascade" }),
  venueOsmId: text("venue_osm_id"),
  venueName: text("venue_name").notNull(),
  city: text("city"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClickSchema = createInsertSchema(clicksTable).omit({ id: true, createdAt: true });
export type InsertClick = z.infer<typeof insertClickSchema>;
export type Click = typeof clicksTable.$inferSelect;
