/**
 * GepHealthService — reacts to Overwolf's public Game Events health feed.
 *
 * GEP features can break per game patch, outside any app's control. Overwolf
 * publishes a machine-readable status feed per game:
 *   https://game-events-status.overwolf.com/{gameId}_prod.json
 * (see dev.overwolf.com/ow-native/live-game-data-gep/game-events-status-health).
 *
 * We poll R6's feed, compare the reported feature states against the features
 * this app actually requires, and hand back any that aren't fully operational
 * so the Diagnostics view can warn the developer/user instead of silently
 * getting no events. Fully dev-safe: any fetch/parse failure (offline, CORS in
 * the browser harness) just yields an empty result — never throws.
 */
import { createLogger } from "@/core/log";
import { R6_GAME_ID } from "@/lib/ow/env";
import { REQUIRED_FEATURES } from "@/lib/gep/types";

const log = createLogger("gep-health");
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 min
const ENDPOINT = (id: number) => `https://game-events-status.overwolf.com/${id}_prod.json`;

// Overwolf state levels (observed): 1 = operational, 2 = may be unavailable,
// 3 = currently unavailable; anything else = unsupported.
const STATE_LABEL: Record<number, string> = {
  1: "operational",
  2: "may be unavailable",
  3: "currently unavailable",
};
const labelFor = (state: number) => STATE_LABEL[state] ?? "unsupported";

interface StatusFeature {
  name?: string;
  state?: number;
}
interface StatusFeed {
  features?: StatusFeature[];
}

export class GepHealthService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly onDegraded: (features: string[]) => void,
    private readonly gameId: number = R6_GAME_ID,
  ) {}

  start(): void {
    void this.check();
    this.timer = setInterval(() => void this.check(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async check(): Promise<void> {
    try {
      const res = await fetch(ENDPOINT(this.gameId), { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const feed = (await res.json()) as StatusFeed;
      const required = new Set(REQUIRED_FEATURES);
      const degraded: string[] = [];
      for (const f of feed.features ?? []) {
        if (!f?.name || !required.has(f.name)) continue;
        const state = Number(f.state);
        if (state !== 1) degraded.push(`${f.name} — ${labelFor(state)}`);
      }
      this.onDegraded(degraded);
      if (degraded.length) log.warn("degraded GEP features", degraded);
    } catch {
      // Offline or CORS-blocked (dev browser) — leave prior status untouched.
    }
  }
}
