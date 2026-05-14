import { Router, Request, Response } from "express";
import { db, usersTable, clicksTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateUserBody,
  LoginUserBody,
  GetUserParams,
  VerifyUserPinParams,
  VerifyUserPinBody,
  GetUserStatsParams,
} from "@workspace/api-zod";
import crypto from "crypto";
import { serializeUser } from "../lib/serializers";

const router = Router();
const PIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const PIN_ATTEMPT_LOCK_MS = 10 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 5;
type PinAttempt = { count: number; resetAt: number; lockedUntil?: number };
const pinAttempts = new Map<string, PinAttempt>();

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

function normalizeNickname(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function normalizeAuthInput(input: { deviceId: string; nickname: string; pin: string }) {
  return {
    deviceId: input.deviceId.trim(),
    nickname: normalizeNickname(input.nickname),
    pin: input.pin.trim(),
  };
}

function isValidNickname(nickname: string): boolean {
  return nickname.length >= 2 && nickname.length <= 20;
}

function isValidPin(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin);
}

function validateAuthInput(input: { deviceId: string; nickname: string; pin: string }): string | null {
  if (input.deviceId.length < 8 || input.deviceId.length > 128) return "Invalid deviceId";
  if (!isValidNickname(input.nickname)) return "Invalid nickname";
  if (!isValidPin(input.pin)) return "Invalid PIN";
  return null;
}

function pinAttemptKey(req: Request, nickname: string): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${nickname.toLowerCase()}`;
}

function getPinAttempt(key: string) {
  const now = Date.now();
  const attempt = pinAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    const fresh: PinAttempt = { count: 0, resetAt: now + PIN_ATTEMPT_WINDOW_MS };
    pinAttempts.set(key, fresh);
    return fresh;
  }
  return attempt;
}

function isPinLocked(key: string): boolean {
  const attempt = getPinAttempt(key);
  return Boolean(attempt.lockedUntil && attempt.lockedUntil > Date.now());
}

function recordPinFailure(key: string): void {
  const attempt = getPinAttempt(key);
  attempt.count += 1;
  if (attempt.count >= MAX_PIN_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + PIN_ATTEMPT_LOCK_MS;
    attempt.count = 0;
    attempt.resetAt = attempt.lockedUntil;
  }
  pinAttempts.set(key, attempt);
}

function clearPinAttempts(key: string): void {
  pinAttempts.delete(key);
}

async function findUserByNickname(nickname: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.nickname}) = ${nickname.toLowerCase()}`)
    .limit(1);
  return user;
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

  const { deviceId, nickname, pin } = normalizeAuthInput(parseResult.data);
  const validationError = validateAuthInput({ deviceId, nickname, pin });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

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
  const byNickname = await findUserByNickname(nickname);

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

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parseResult = LoginUserBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const { deviceId, nickname, pin } = normalizeAuthInput(parseResult.data);
  const validationError = validateAuthInput({ deviceId, nickname, pin });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const attemptKey = pinAttemptKey(req, nickname);
  if (isPinLocked(attemptKey)) {
    res.status(429).json({ error: "Too many PIN attempts" });
    return;
  }

  const user = await findUserByNickname(nickname);
  if (!user || !verifyPin(pin, user.pinHash)) {
    recordPinFailure(attemptKey);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: "User is blocked" });
    return;
  }

  clearPinAttempts(attemptKey);

  if (user.deviceId === deviceId) {
    res.json(serializeUser(user));
    return;
  }

  const [deviceOwner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.deviceId, deviceId));

  if (deviceOwner && deviceOwner.id !== user.id) {
    res.status(409).json({ error: "Device already linked to another account" });
    return;
  }

  const updatedUser = await db.transaction(async (tx) => {
    await tx
      .update(clicksTable)
      .set({ deviceId })
      .where(eq(clicksTable.deviceId, user.deviceId));

    const [updated] = await tx
      .update(usersTable)
      .set({ deviceId })
      .where(eq(usersTable.id, user.id))
      .returning();

    return updated;
  });

  res.json(serializeUser(updatedUser));
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

  const attemptKey = pinAttemptKey(req, user.nickname);
  if (isPinLocked(attemptKey)) {
    res.status(429).json({ error: "Too many PIN attempts" });
    return;
  }

  const valid = verifyPin(bodyResult.data.pin, user.pinHash);
  if (valid) clearPinAttempts(attemptKey);
  else recordPinFailure(attemptKey);
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
