import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  nickname: text("nickname").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  clickCount: integer("click_count").notNull().default(0),
  isBlocked: boolean("is_blocked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, clickCount: true, isBlocked: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
