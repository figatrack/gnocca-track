import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hotspotsRouter from "./hotspots";
import clicksRouter from "./clicks";
import usersRouter from "./users";
import adminRouter from "./admin";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/hotspots", hotspotsRouter);
router.use("/clicks", clicksRouter);
router.use("/users", usersRouter);
router.use("/config", configRouter);
router.use("/admin", adminRouter);

export default router;
