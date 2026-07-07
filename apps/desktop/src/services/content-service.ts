/**
 * ContentService — automatic patch/content updates.
 *
 * Game content (operators, maps, weapons, balance, the active season label)
 * is data, not code. The app ships with a bundled snapshot from
 * @siegeiq/game-data so it always works offline, then checks the backend for a
 * newer content manifest on boot and caches it. When Ubisoft ships a new
 * season the server publishes updated data and every client picks it up with
 * no app update — future seasons are a data change, not a code change.
 *
 * Overwolf itself keeps the *app binary* current through the store; this keeps
 * the *game data* current between those releases.
 */
import { GAME_DATA_VERSION, GAME_DATA_UPDATED } from "@siegeiq/game-data";
import { createLogger } from "@/core/log";
import { getBus, type AppBus } from "@/core/bus";
import { readJSON, writeJSON } from "@/core/storage";
import { api } from "@/api/client";

const log = createLogger("content");
const CACHE_KEY = "content.manifest.v1";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6h while running

export interface ContentManifest {
  version: string; // e.g. "Y11S2.1"
  updated: string; // ISO date
  season?: { code: string; name: string };
}

/** Compare season/patch labels like "Y11S2.1" — higher is newer. */
function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) => (v.match(/\d+/g) ?? []).map(Number);
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export class ContentService {
  private manifest: ContentManifest;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly bus: AppBus = getBus()) {
    const bundled: ContentManifest = { version: GAME_DATA_VERSION, updated: GAME_DATA_UPDATED };
    // Prefer a cached manifest only if it's newer than what we ship bundled.
    const cached = readJSON<ContentManifest>(CACHE_KEY, bundled);
    this.manifest = isNewer(cached.version, bundled.version) ? cached : bundled;
  }

  start(): void {
    void this.check();
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  currentVersion(): string {
    return this.manifest.version;
  }

  getManifest(): ContentManifest {
    return this.manifest;
  }

  /** Ask the backend whether newer content exists; cache + announce if so. */
  async check(): Promise<void> {
    try {
      const res = await fetch(`${api.baseUrl}/api/content/manifest`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const next = (await res.json()) as ContentManifest;
      if (!next?.version || !isNewer(next.version, this.manifest.version)) return;
      this.manifest = next;
      writeJSON(CACHE_KEY, next);
      this.bus.emit("content:updated", { version: next.version });
      log.info(`content updated to ${next.version}`);
    } catch {
      // Offline or backend down — the bundled snapshot keeps working.
    }
  }
}
