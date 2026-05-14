import type { hotspotsTable, usersTable } from "@workspace/db";

// Shared intensity computation — single source of truth used by all routes
export function computeIntensity(clickCount: number): "low" | "medium" | "high" | "bomb" {
  if (clickCount >= 20) return "bomb";
  if (clickCount >= 10) return "high";
  if (clickCount >= 4) return "medium";
  return "low";
}

export function serializeHotspot(h: typeof hotspotsTable.$inferSelect) {
  return {
    id: h.id,
    lat: h.lat,
    lng: h.lng,
    intensity: computeIntensity(h.clickCount),
    clickCount: h.clickCount,
    isSeed: h.isSeed,
    isActive: h.isActive,
    venueOsmId: h.venueOsmId ?? null,
    venueName: h.venueName,
    venueType: h.venueType ?? null,
    city: h.city,
    area: h.area ?? null,
    createdAt: h.createdAt.toISOString(),
    expiresAt: h.expiresAt ? h.expiresAt.toISOString() : null,
  };
}

export function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    deviceId: u.deviceId,
    nickname: u.nickname,
    clickCount: u.clickCount,
    isBlocked: u.isBlocked,
    createdAt: u.createdAt.toISOString(),
  };
}
