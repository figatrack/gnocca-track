import { Router, Request, Response } from "express";
import { db, clicksTable, hotspotsTable, usersTable, adminConfigTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  RegisterClickBody,
  GetUserClicksParams,
  GetCooldownStatusParams,
} from "@workspace/api-zod";
import { computeIntensity } from "../lib/serializers";

const router = Router();

async function getConfig() {
  const [config] = await db.select().from(adminConfigTable).limit(1);
  return config ?? { clickDurationMinutes: 30, clickCooldownMinutes: 30 };
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parseResult = RegisterClickBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const { deviceId, lat, lng, venueName, venueOsmId, city } = parseResult.data;

  // Check if user is blocked
  const [user] = await db
    .select({ isBlocked: usersTable.isBlocked })
    .from(usersTable)
    .where(eq(usersTable.deviceId, deviceId));

  if (!user) {
    res.status(401).json({ error: "User is not registered" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: "User is blocked" });
    return;
  }

  const config = await getConfig();
  const cooldownMs = config.clickCooldownMinutes * 60 * 1000;
  const cooldownStart = new Date(Date.now() - cooldownMs);

  const [lastClick] = await db
    .select()
    .from(clicksTable)
    .where(eq(clicksTable.deviceId, deviceId))
    .orderBy(desc(clicksTable.createdAt))
    .limit(1);

  if (lastClick && lastClick.createdAt > cooldownStart) {
    const msRemaining = lastClick.createdAt.getTime() + cooldownMs - Date.now();
    const secondsRemaining = Math.ceil(msRemaining / 1000);
    res.status(429).json({
      canClick: false,
      secondsRemaining,
      nextClickAt: new Date(lastClick.createdAt.getTime() + cooldownMs).toISOString(),
    });
    return;
  }

  const durationMs = config.clickDurationMinutes * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs);

  const click = await db.transaction(async (tx) => {
    const [existingHotspot] = await tx
      .select()
      .from(hotspotsTable)
      .where(
        venueOsmId
          ? eq(hotspotsTable.venueOsmId, venueOsmId)
          : and(eq(hotspotsTable.venueName, venueName), eq(hotspotsTable.city, city ?? ""))
      )
      .limit(1);

    let hotspotId: number;

    if (existingHotspot) {
      const newCount = existingHotspot.clickCount + 1;
      await tx
        .update(hotspotsTable)
        .set({
          clickCount: newCount,
          intensity: computeIntensity(newCount),
          isActive: true,
          venueOsmId: existingHotspot.venueOsmId ?? venueOsmId ?? null,
          ...(existingHotspot.isSeed ? {} : { expiresAt }),
        })
        .where(eq(hotspotsTable.id, existingHotspot.id));
      hotspotId = existingHotspot.id;
    } else {
      const [newHotspot] = await tx
        .insert(hotspotsTable)
        .values({
          lat,
          lng,
          venueOsmId: venueOsmId ?? null,
          venueName,
          city: city ?? "",
          clickCount: 1,
          intensity: "low",
          isSeed: false,
          isActive: true,
          expiresAt,
        })
        .returning();
      hotspotId = newHotspot.id;
    }

    const [registeredClick] = await tx
      .insert(clicksTable)
      .values({ deviceId, hotspotId, venueOsmId: venueOsmId ?? null, venueName, city: city ?? null })
      .returning();

    await tx
      .update(usersTable)
      .set({ clickCount: sql`${usersTable.clickCount} + 1` })
      .where(eq(usersTable.deviceId, deviceId));

    return registeredClick;
  });

  res.status(201).json({ ...click, createdAt: click.createdAt.toISOString() });
});

router.get("/user/:deviceId", async (req: Request, res: Response): Promise<void> => {
  const parseResult = GetUserClicksParams.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const clicks = await db
    .select()
    .from(clicksTable)
    .where(eq(clicksTable.deviceId, parseResult.data.deviceId))
    .orderBy(desc(clicksTable.createdAt))
    .limit(50);

  res.json(clicks.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.get("/cooldown/:deviceId", async (req: Request, res: Response): Promise<void> => {
  const parseResult = GetCooldownStatusParams.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const config = await getConfig();
  const cooldownMs = config.clickCooldownMinutes * 60 * 1000;
  const cooldownStart = new Date(Date.now() - cooldownMs);

  const [lastClick] = await db
    .select()
    .from(clicksTable)
    .where(eq(clicksTable.deviceId, parseResult.data.deviceId))
    .orderBy(desc(clicksTable.createdAt))
    .limit(1);

  if (!lastClick || lastClick.createdAt <= cooldownStart) {
    res.json({ canClick: true, secondsRemaining: 0, nextClickAt: null });
    return;
  }

  const msRemaining = lastClick.createdAt.getTime() + cooldownMs - Date.now();
  res.json({
    canClick: false,
    secondsRemaining: Math.ceil(msRemaining / 1000),
    nextClickAt: new Date(lastClick.createdAt.getTime() + cooldownMs).toISOString(),
  });
});

export default router;
