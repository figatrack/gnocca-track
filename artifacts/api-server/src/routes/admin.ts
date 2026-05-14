import { Router, Request, Response } from "express";
import { db, hotspotsTable, usersTable, clicksTable, adminConfigTable } from "@workspace/db";
import { eq, desc, gte, count } from "drizzle-orm";
import {
  UpdateAdminConfigBody,
  AdminCreateHotspotBody,
  AdminUpdateHotspotParams,
  AdminUpdateHotspotBody,
  AdminDeleteHotspotParams,
  AdminBlockUserParams,
  AdminUnblockUserParams,
} from "@workspace/api-zod";
import { serializeHotspot, serializeUser } from "../lib/serializers";

const router = Router();

router.use((req, res, next) => {
  const expectedPin = process.env.ADMIN_PIN;
  if (!expectedPin) {
    res.status(503).json({ error: "ADMIN_PIN is not configured" });
    return;
  }

  const providedPin = req.header("x-admin-pin");
  if (providedPin !== expectedPin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
});

// ─── Config ──────────────────────────────────────────────────────────────────

router.get("/config", async (_req: Request, res: Response): Promise<void> => {
  let [config] = await db.select().from(adminConfigTable).limit(1);
  if (!config) {
    [config] = await db.insert(adminConfigTable).values({}).returning();
  }
  res.json({ ...config, updatedAt: config.updatedAt.toISOString() });
});

router.patch("/config", async (req: Request, res: Response): Promise<void> => {
  const parseResult = UpdateAdminConfigBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  let [config] = await db.select().from(adminConfigTable).limit(1);
  if (!config) {
    [config] = await db.insert(adminConfigTable).values({}).returning();
  }

  const [updated] = await db
    .update(adminConfigTable)
    .set({ ...parseResult.data, updatedAt: new Date() })
    .where(eq(adminConfigTable.id, config.id))
    .returning();

  res.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
});

// ─── Hotspots ─────────────────────────────────────────────────────────────────

router.get("/hotspots", async (_req: Request, res: Response): Promise<void> => {
  const hotspots = await db
    .select()
    .from(hotspotsTable)
    .orderBy(desc(hotspotsTable.createdAt));
  res.json(hotspots.map(serializeHotspot));
});

router.post("/hotspots", async (req: Request, res: Response): Promise<void> => {
  const parseResult = AdminCreateHotspotBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const [hotspot] = await db
    .insert(hotspotsTable)
    .values({
      ...parseResult.data,
      isSeed: parseResult.data.isSeed ?? true,
      isActive: parseResult.data.isActive ?? true,
    })
    .returning();

  res.status(201).json(serializeHotspot(hotspot));
});

router.patch("/hotspots/:id", async (req: Request, res: Response): Promise<void> => {
  const paramResult = AdminUpdateHotspotParams.safeParse({ id: Number(req.params.id) });
  const bodyResult = AdminUpdateHotspotBody.safeParse(req.body);
  if (!paramResult.success || !bodyResult.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [updated] = await db
    .update(hotspotsTable)
    .set(bodyResult.data)
    .where(eq(hotspotsTable.id, paramResult.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeHotspot(updated));
});

router.delete("/hotspots/:id", async (req: Request, res: Response): Promise<void> => {
  const parseResult = AdminDeleteHotspotParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(hotspotsTable).where(eq(hotspotsTable.id, parseResult.data.id));
  res.status(204).send();
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get("/users", async (_req: Request, res: Response): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  res.json(users.map(serializeUser));
});

router.post("/users/:id/block", async (req: Request, res: Response): Promise<void> => {
  const parseResult = AdminBlockUserParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ isBlocked: true })
    .where(eq(usersTable.id, parseResult.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeUser(updated));
});

router.post("/users/:id/unblock", async (req: Request, res: Response): Promise<void> => {
  const parseResult = AdminUnblockUserParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ isBlocked: false })
    .where(eq(usersTable.id, parseResult.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeUser(updated));
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0); // UTC-based — consistent across timezones

  const [[usersRow], [clicksRow], [activeHotspotsRow], [todayClicksRow]] = await Promise.all([
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(clicksTable),
    db.select({ count: count() }).from(hotspotsTable).where(eq(hotspotsTable.isActive, true)),
    db.select({ count: count() }).from(clicksTable).where(gte(clicksTable.createdAt, todayStart)),
  ]);

  const topVenuesRaw = await db
    .select({ venueName: clicksTable.venueName, clickCount: count() })
    .from(clicksTable)
    .groupBy(clicksTable.venueName)
    .orderBy(desc(count()))
    .limit(5);

  res.json({
    totalUsers: usersRow.count,
    totalClicks: clicksRow.count,
    activeHotspots: activeHotspotsRow.count,
    clicksToday: todayClicksRow.count,
    topVenues: topVenuesRaw.map((v) => ({
      venueName: v.venueName,
      clickCount: Number(v.clickCount),
    })),
  });
});

export default router;
