import type { FastifyInstance } from "fastify";
import { playersRoutes } from "./players";
import { liveRoutes } from "./live";
import { systemRoutes } from "./system";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(playersRoutes, { prefix: "/api" });
  await app.register(liveRoutes, { prefix: "/api" });
  await app.register(systemRoutes, { prefix: "/api" });
}
