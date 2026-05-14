import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminConfigTable = pgTable("admin_config", {
  id: serial("id").primaryKey(),
  clickDurationMinutes: integer("click_duration_minutes").notNull().default(30),
  clickCooldownMinutes: integer("click_cooldown_minutes").notNull().default(30),
  maxVenuesShown: integer("max_venues_shown").notNull().default(6),
  defaultRadiusMeters: integer("default_radius_meters").notNull().default(100),
  appTextMainButton: text("app_text_main_button").notNull().default("Qui Gnocca"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminConfigSchema = createInsertSchema(adminConfigTable).omit({ id: true });
export type InsertAdminConfig = z.infer<typeof insertAdminConfigSchema>;
export type AdminConfig = typeof adminConfigTable.$inferSelect;
