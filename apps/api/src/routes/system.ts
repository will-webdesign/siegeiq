import type { FastifyInstance } from "fastify";
import { fail, ok } from "../envelope";
import { TTL, cache, cached } from "@siegeiq/server/cache";
import { isDbEnabled, tryDb } from "@siegeiq/server/db";
import { env, isDemoMode } from "@siegeiq/server/env";
import { providerHealth, withFailover } from "@siegeiq/server/providers/registry";
import { GAME_DATA_UPDATED, GAME_DATA_VERSION } from "@siegeiq/game-data";

export async function systemRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => {
    const cacheStats = await cache().stats();
    const dbOk = isDbEnabled()
      ? (await tryDb(async (db) => db.$queryRaw`SELECT 1`)) !== null
      : null;
    return reply.send({
      status: "ok",
      demoMode: isDemoMode(),
      providers: providerHealth(),
      cache: cacheStats,
      database: isDbEnabled() ? (dbOk ? "connected" : "error") : "not configured",
      gameData: { version: GAME_DATA_VERSION, updated: GAME_DATA_UPDATED },
      time: new Date().toISOString(),
    });
  });

  app.get("/status", async (_req, reply) => {
    try {
      let source = "cache";
      const hit = await cached("service-status", TTL.serviceStatus, async () => {
        const res = await withFailover("getStatus", (p) => p.getStatus());
        source = res.source;
        return res.data;
      });
      return await ok(reply, { data: hit.value, source, fetchedAt: hit.fetchedAt, stale: hit.stale });
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/admin/overview", async (req, reply) => {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    const expected = env().ADMIN_TOKEN;
    if (!expected || token !== expected) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const [cacheStats, players, snapshots, matches] = await Promise.all([
      cache().stats(),
      tryDb((db) => db.player.count()),
      tryDb((db) => db.profileSnapshot.count()),
      tryDb((db) => db.inferredMatch.count()),
    ]);
    return reply.send({
      demoMode: isDemoMode(),
      providers: providerHealth(),
      cache: cacheStats,
      database: { enabled: isDbEnabled(), players, snapshots, inferredMatches: matches },
      time: new Date().toISOString(),
    });
  });
}
