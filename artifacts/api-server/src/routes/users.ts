import { Router, Request, Response } from "express";
import { db, usersTable, clicksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateUserBody,
  GetUserParams,
  VerifyUserPinParams,
  VerifyUserPinBody,
  GetUserStatsParams,
} from "@workspace/api-zod";
import crypto from "crypto";
import { serializeUser } from "../lib/serializers";

const router = Router();

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  if (storedHash.startsWith("scrypt$")) {
    const [, salt, key] = storedHash.split("$");
    if (!salt || !key) return false;
    const derived = crypto.scryptSync(pin, salt, 64);
    const expected = Buffer.from(key, "hex");
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  }

  return false;
}

function getBadge(clickCount: number): { badge: string; badgeLabel: string } {
  if (clickCount >= 20) return { badge: "leggenda", badgeLabel: "Leggenda" };
  if (clickCount >= 5) return { badge: "radar", badgeLabel: "Radar" };
  return { badge: "novizio", badgeLabel: "Novizio" };
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parseResult = CreateUserBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const { deviceId, nickname, pin } = parseResult.data;

  // Check deviceId uniqueness (device already registered)
  const [byDevice] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.deviceId, deviceId));

  if (byDevice) {
    res.status(409).json({ error: "Device already registered" });
    return;
  }

  // Check nickname uniqueness
  const [byNickname] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.nickname, nickname));

  if (byNickname) {
    res.status(409).json({ error: "Nickname already taken" });
    return;
  }

  try {
    const pinHash = hashPin(pin);
    const [user] = await db.insert(usersTable).values({ deviceId, nickname, pinHash }).returning();
    res.status(201).json(serializeUser(user));
  } catch (err: unknown) {
    // Catch any remaining DB unique constraint violations (race condition safety net)
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({ error: "Conflict" });
      return;
    }
    throw err;
  }
});

router.get("/:deviceId", async (req: Request, res: Response): Promise<void> => {
  const parseResult = GetUserParams.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.deviceId, parseResult.data.deviceId));

  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeUser(user));
});

router.post("/:deviceId/verify-pin", async (req: Request, res: Response): Promise<void> => {
  const paramResult = VerifyUserPinParams.safeParse(req.params);
  const bodyResult = VerifyUserPinBody.safeParse(req.body);
  if (!paramResult.success || !bodyResult.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.deviceId, paramResult.data.deviceId));

  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const valid = verifyPin(bodyResult.data.pin, user.pinHash);
  res.json({ valid });
});

router.get("/:deviceId/stats", async (req: Request, res: Response): Promise<void> => {
  const parseResult = GetUserStatsParams.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.deviceId, parseResult.data.deviceId));

  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const recentClicks = await db
    .select()
    .from(clicksTable)
    .where(eq(clicksTable.deviceId, parseResult.data.deviceId))
    .orderBy(desc(clicksTable.createdAt))
    .limit(10);

  const { badge, badgeLabel } = getBadge(user.clickCount);

  res.json({
    clickCount: user.clickCount,
    badge,
    badgeLabel,
    recentClicks: recentClicks.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

export default router;
