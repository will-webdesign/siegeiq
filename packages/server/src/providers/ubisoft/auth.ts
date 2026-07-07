import { UBI } from "@siegeiq/shared";
import { env } from "@siegeiq/server/env";
import { logger } from "@siegeiq/shared";
import { HttpError, withRetry } from "@siegeiq/server/retry";
import { cache } from "@siegeiq/server/cache";

const log = logger("ubisoft:auth");

export interface UbiSession {
  ticket: string;
  sessionId: string;
  expiration: string; // ISO
}

const SESSION_KEY = "ubi:session:v1";
const LOCK_KEY = "ubi:session:lock";

/**
 * Ubisoft session (ticket) manager.
 *
 * POST /v3/profiles/sessions with Basic auth returns a ticket valid ~3h.
 * Rules learned from community wrappers (docs/RESEARCH.md §2.1):
 *  - re-login sparingly: Ubisoft 429s aggressive login loops
 *  - cache the ticket until shortly before expiry
 *  - single-flight the login so concurrent requests share one attempt
 */
let inflight: Promise<UbiSession> | null = null;

async function login(): Promise<UbiSession> {
  const { UBI_EMAIL, UBI_PASSWORD } = env();
  if (!UBI_EMAIL || !UBI_PASSWORD) {
    throw new Error("Ubisoft credentials not configured (UBI_EMAIL / UBI_PASSWORD)");
  }
  const basic = Buffer.from(`${UBI_EMAIL}:${UBI_PASSWORD}`).toString("base64");

  const res = await withRetry(
    async () => {
      const r = await fetch(`${UBI.BASE}/v3/profiles/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Ubi-AppId": UBI.APP_ID,
          "Content-Type": "application/json; charset=UTF-8",
          "User-Agent": "SiegeIQ/0.1 (+contact via site)",
        },
        body: JSON.stringify({ rememberMe: true }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new HttpError(r.status, `ubisoft login failed: ${r.status}`, await r.text());
      return r;
    },
    { retries: 2, baseDelayMs: 2_000, maxDelayMs: 15_000 },
  );

  const json = (await res.json()) as { ticket: string; sessionId: string; expiration: string };
  if (!json.ticket) throw new Error("ubisoft login: no ticket in response");
  log.info("obtained new ubisoft session", { expires: json.expiration });
  return { ticket: json.ticket, sessionId: json.sessionId, expiration: json.expiration };
}

export async function getSession(forceRefresh = false): Promise<UbiSession> {
  if (!forceRefresh) {
    const raw = await cache().get(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as UbiSession;
      // refresh 10 minutes before expiry
      if (new Date(s.expiration).getTime() - Date.now() > 10 * 60 * 1000) return s;
    }
  }
  if (!inflight) {
    inflight = (async () => {
      // best-effort distributed lock (no-op on memory backend)
      await cache().set(LOCK_KEY, "1", 30);
      try {
        const s = await login();
        const ttl = Math.max(
          60,
          Math.floor((new Date(s.expiration).getTime() - Date.now()) / 1000) - 600,
        );
        await cache().set(SESSION_KEY, JSON.stringify(s), ttl);
        return s;
      } finally {
        await cache().del(LOCK_KEY);
        inflight = null;
      }
    })();
  }
  return inflight;
}

export function authHeaders(s: UbiSession, appId: string = UBI.APP_ID): Record<string, string> {
  return {
    Authorization: `ubi_v1 t=${s.ticket}`,
    "Ubi-AppId": appId,
    "Ubi-SessionId": s.sessionId,
    "User-Agent": "SiegeIQ/0.1 (+contact via site)",
    "Content-Type": "application/json",
  };
}
