import { Router, Request, Response } from "express";
import { db, hotspotsTable, clicksTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { ListHotspotsQueryParams, GetHotspotParams } from "@workspace/api-zod";
import { computeIntensity, serializeHotspot } from "../lib/serializers";

const router = Router();

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
