import { env } from "@siegeiq/server/env";
import { logger } from "@siegeiq/shared";

const log = logger("cache");

/**
 * Read-through cache: Redis when REDIS_URL is set, otherwise an in-process
 * LRU-ish Map (fine for dev/demo; production should run Redis).
 */
interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  stats(): Promise<{ backend: string; keys?: number }>;
}

class MemoryBackend implements CacheBackend {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private readonly max = 5_000;

  async get(key: string) {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    if (this.store.size >= this.max) {
      const first = this.store.keys().next().value;
      if (first) this.store.delete(first);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async del(key: string) {
    this.store.delete(key);
  }
  async stats() {
    return { backend: "memory", keys: this.store.size };
  }
}

class RedisBackend implements CacheBackend {
  // Lazy import so builds/demo mode never require ioredis to connect.
  private clientPromise: Promise<import("ioredis").default> | null = null;

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("ioredis").then(({ default: Redis }) => {
        const c = new Redis(env().REDIS_URL, {
          maxRetriesPerRequest: 2,
          lazyConnect: false,
          enableOfflineQueue: false,
        });
        c.on("error", (e) => log.warn("redis error", { error: String(e) }));
        return c;
      });
    }
    return this.clientPromise;
  }

  async get(key: string) {
    try {
      return await (await this.client()).get(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string, ttlSeconds: number) {
    try {
      await (await this.client()).set(key, value, "EX", ttlSeconds);
    } catch {
      /* cache write failures are non-fatal */
    }
  }
  async del(key: string) {
    try {
      await (await this.client()).del(key);
    } catch {
      /* ignore */
    }
  }
  async stats() {
    try {
      const c = await this.client();
      const n = await c.dbsize();
      return { backend: "redis", keys: n };
    } catch {
      return { backend: "redis (unreachable)" };
    }
  }
}

let backend: CacheBackend | null = null;

export function cache(): CacheBackend {
  if (!backend) {
    backend = env().REDIS_URL ? new RedisBackend() : new MemoryBackend();
  }
  return backend;
}

export interface Cached<T> {
  value: T;
  fetchedAt: number;
  stale: boolean;
}

/**
 * Read-through with stale-while-revalidate: within ttl → fresh; within
 * ttl*2 → served stale while a background refresh runs; beyond → blocking fetch.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<Cached<T>> {
  const raw = await cache().get(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { v: T; t: number };
      const age = (Date.now() - parsed.t) / 1000;
      if (age <= ttlSeconds) return { value: parsed.v, fetchedAt: parsed.t, stale: false };
      if (age <= ttlSeconds * 2) {
        // Serve stale, refresh in background (fire and forget).
        void fetcher()
          .then((v) => cache().set(key, JSON.stringify({ v, t: Date.now() }), ttlSeconds * 2))
          .catch((e) => log.debug("swr refresh failed", { key, error: String(e) }));
        return { value: parsed.v, fetchedAt: parsed.t, stale: true };
      }
    } catch {
      /* fall through to fetch */
    }
  }
  const v = await fetcher();
  await cache().set(key, JSON.stringify({ v, t: Date.now() }), ttlSeconds * 2);
  return { value: v, fetchedAt: Date.now(), stale: false };
}

export const TTL = {
  identity: 24 * 3600,
  boards: 180,
  detailedStats: 900,
  serviceStatus: 60,
  news: 1800,
  leaderboard: 300,
} as const;
