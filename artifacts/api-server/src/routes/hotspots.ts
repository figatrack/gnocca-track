import { Router, Request, Response } from "express";
import { db, hotspotsTable, clicksTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ListHotspotsQueryParams, GetHotspotParams } from "@workspace/api-zod";
import { computeIntensity, serializeHotspot } from "../lib/serializers";

const router = Router();
const DEFAULT_RADIUS_METERS = 50_000;
const MIN_RADIUS_METERS = 500;
const MAX_RADIUS_METERS = 100_000;

function clampRadius(radius?: number): number {
  if (!radius || !Number.isFinite(radius)) return DEFAULT_RADIUS_METERS;
  return Math.min(Math.max(radius, MIN_RADIUS_METERS), MAX_RADIUS_METERS);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const hotspots = await db
    .select()
    .from(hotspotsTable)
    .where(
      and(
        eq(hotspotsTable.isActive, true),
        sql`(${hotspotsTable.expiresAt} IS NULL OR ${hotspotsTable.expiresAt} > ${now})`
      )
    );

  const byIntensity = { low: 0, medium: 0, high: 0, bomb: 0 };
  const cityCount: Record<string, number> = {};

  for (const h of hotspots) {
    const intensity = computeIntensity(h.clickCount) as keyof typeof byIntensity;
    byIntensity[intensity]++;
    if (h.city) cityCount[h.city] = (cityCount[h.city] ?? 0) + 1;
  }

  const topCity = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [todayClicks] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clicksTable)
    .where(gte(clicksTable.createdAt, todayStart));

  res.json({
    totalActive: hotspots.length,
    byIntensity,
    topCity,
    totalClicksToday: todayClicks?.count ?? 0,
  });
});

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const parseResult = ListHotspotsQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { lat, lng, radius } = parseResult.data;
  if ((lat === undefined) !== (lng === undefined)) {
    res.status(400).json({ error: "lat and lng must be provided together" });
    return;
  }

  const now = new Date();
  const activeWhere = and(
    eq(hotspotsTable.isActive, true),
    sql`(${hotspotsTable.expiresAt} IS NULL OR ${hotspotsTable.expiresAt} > ${now})`
  );

  if (lat !== undefined && lng !== undefined) {
    const radiusMeters = clampRadius(radius);
    const latDelta = radiusMeters / 111_320;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const lngDelta = radiusMeters / (111_320 * Math.max(Math.abs(cosLat), 0.01));

    const nearbyHotspots = await db
      .select()
      .from(hotspotsTable)
      .where(
        and(
          activeWhere,
          gte(hotspotsTable.lat, lat - latDelta),
          lte(hotspotsTable.lat, lat + latDelta),
          gte(hotspotsTable.lng, lng - lngDelta),
          lte(hotspotsTable.lng, lng + lngDelta)
        )
      );

    const sorted = nearbyHotspots
      .map((hotspot) => ({
        hotspot,
        distance: haversineDistance(lat, lng, hotspot.lat, hotspot.lng),
      }))
      .filter(({ distance }) => distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance)
      .map(({ hotspot }) => serializeHotspot(hotspot));

    res.json(sorted);
    return;
  }

  const hotspots = await db
    .select()
    .from(hotspotsTable)
    .where(activeWhere);

  res.json(hotspots.map(serializeHotspot));
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const parseResult = GetHotspotParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [hotspot] = await db
    .select()
    .from(hotspotsTable)
    .where(eq(hotspotsTable.id, parseResult.data.id));

  if (!hotspot) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(serializeHotspot(hotspot));
});

export default router;
