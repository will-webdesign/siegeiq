import { env } from "@siegeiq/server/env";
import { logger } from "@siegeiq/shared";
import type { PrismaClient } from "@prisma/client";

const log = logger("db");

/**
 * Lazy Prisma singleton. The app must run without a database (demo mode,
 * `next build`) — so we only instantiate when DATABASE_URL exists and only
 * connect on first query. All persistence is best-effort: history recording
 * degrades gracefully instead of breaking page loads.
 */
declare global {
  var __siegeiqPrisma: PrismaClient | undefined;
}

export function isDbEnabled(): boolean {
  return Boolean(env().DATABASE_URL);
}

export async function db(): Promise<PrismaClient | null> {
  if (!isDbEnabled()) return null;
  if (!globalThis.__siegeiqPrisma) {
    try {
      const { PrismaClient } = await import("@prisma/client");
      globalThis.__siegeiqPrisma = new PrismaClient();
    } catch (e) {
      log.error("prisma init failed", { error: String(e) });
      return null;
    }
  }
  return globalThis.__siegeiqPrisma;
}

/** Run a persistence action without letting failures break the request. */
export async function tryDb<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T | null> {
  const client = await db();
  if (!client) return null;
  try {
    return await fn(client);
  } catch (e) {
    log.warn("db operation failed (non-fatal)", { error: String(e) });
    return null;
  }
}
