import { Router, type Request, type Response } from "express";
import { db, adminConfigTable } from "@workspace/db";

const router = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  let [config] = await db.select().from(adminConfigTable).limit(1);
  if (!config) {
    [config] = await db.insert(adminConfigTable).values({}).returning();
  }

  res.json({
    clickDurationMinutes: config.clickDurationMinutes,
    clickCooldownMinutes: config.clickCooldownMinutes,
    maxVenuesShown: config.maxVenuesShown,
    defaultRadiusMeters: config.defaultRadiusMeters,
    appTextMainButton: config.appTextMainButton,
  });
});

export default router;
