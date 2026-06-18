import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const staticDirCandidates = [
  process.env["STATIC_DIR"],
  path.resolve(serverDir, "../../../artifacts/cleaning-schedule/dist/public"),
  path.resolve(process.cwd(), "artifacts/cleaning-schedule/dist/public"),
].filter((candidate): candidate is string => Boolean(candidate));

const staticDir = staticDirCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, "index.html")),
);

if (staticDir) {
  app.use(express.static(staticDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  logger.warn({ staticDirCandidates }, "Frontend static build not found");
}

export default app;
