import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const corsOrigin = process.env.CORS_ORIGIN;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function findFrontendDistDir(): string | null {
  const candidates = [
    process.env.FRONTEND_DIST_DIR,
    path.resolve(process.cwd(), "artifacts/gnocca-track/dist/public"),
    path.resolve(process.cwd(), "../gnocca-track/dist/public"),
    path.resolve(moduleDir, "../../gnocca-track/dist/public"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html"))) ?? null;
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const frontendDistDir = findFrontendDistDir();
if (frontendDistDir) {
  app.use(express.static(frontendDistDir, { index: false }));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(frontendDistDir, "index.html"));
  });
}

export default app;
