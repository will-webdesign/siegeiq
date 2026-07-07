/**
 * SiegeIQ API service — the single backend for the Overwolf desktop app and
 * the marketing site. All provider credentials, caching and persistence live
 * here so end users never configure anything.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { logger } from "@siegeiq/shared";
import { registerRoutes } from "./routes/index";
import { startLiveServer } from "./live/live-server";

const log = logger("api");
const PORT = Number(process.env.API_PORT ?? 4000);

async function main() {
  const app = Fastify({ logger: false });
  await app.register(cors, {
    // Overwolf app origins + local dev + configured site origin.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed =
        origin.startsWith("overwolf-extension://") ||
        origin.startsWith("http://localhost") ||
        origin === process.env.WEB_ORIGIN;
      cb(null, Boolean(allowed));
    },
  });
  await registerRoutes(app);
  startLiveServer();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  log.info("api listening", { port: PORT });
}

main().catch((e) => {
  log.error("api crashed", { error: String(e) });
  process.exit(1);
});
