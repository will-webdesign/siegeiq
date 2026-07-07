import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { env } from "@siegeiq/server/env";
import { logger } from "@siegeiq/shared";
import type { LiveMatchState, LiveRosterPlayer } from "@siegeiq/shared";
import { recordRound } from "@siegeiq/server/coaching/engine";

const log = logger("live-server");

/**
 * Live match WebSocket hub (docs/ARCHITECTURE.md §7).
 *  - /ingest?token=…  ← desktop companion pushes GEP-derived events
 *  - /subscribe?profileId=… ← browser live pages receive state updates
 * State is kept in memory per profileId (a Redis pub/sub fan-out slot is left
 * in place for multi-instance deployments).
 */

const EventSchema = z.object({
  kind: z.enum([
    "match_start",
    "roster",
    "round",
    "kill",
    "death",
    "match_end",
    "heartbeat",
    // Reported once per round for the tracked profile — the one real source
    // of "reduce early deaths" telemetry (docs/PHASE1_PLAN.md §3). Nothing
    // fabricates this if the companion doesn't send it.
    "round_end",
  ]),
  profileId: z.string().min(8),
  map: z.string().nullable().optional(),
  mode: z.string().nullable().optional(),
  round: z.number().int().min(0).optional(),
  side: z.enum(["attacker", "defender"]).nullable().optional(),
  score: z.object({ ally: z.number(), enemy: z.number() }).optional(),
  roster: z
    .array(
      z.object({
        username: z.string(),
        team: z.enum(["ally", "enemy"]),
        operatorSlug: z.string().nullable(),
        kills: z.number().default(0),
        deaths: z.number().default(0),
      }),
    )
    .optional(),
  // round_end payload — only meaningful when kind === "round_end".
  operatorSlug: z.string().nullable().optional(),
  survivedSeconds: z.number().min(0).optional(),
  died: z.boolean().optional(),
});

export type CompanionEvent = z.infer<typeof EventSchema>;

const states = new Map<string, LiveMatchState>();
const subscribers = new Map<string, Set<WebSocket>>();

export function getLiveState(profileId: string): LiveMatchState | null {
  const s = states.get(profileId);
  if (!s) return null;
  // stale after 3 minutes without events
  if (Date.now() - s.updatedAt > 3 * 60_000) return null;
  return s;
}

/** Pairing tokens: HMAC(profileId, PAIRING_SECRET) — issued by the web app,
 *  verified here without shared DB state. */
export function pairingToken(profileId: string): string {
  const mac = createHmac("sha256", env().PAIRING_SECRET).update(profileId).digest("hex");
  return `${profileId}.${mac}`;
}

export function verifyPairingToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const profileId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", env().PAIRING_SECRET).update(profileId).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return profileId;
}

function applyEvent(ev: CompanionEvent): LiveMatchState {
  const prev = states.get(ev.profileId);
  const next: LiveMatchState = {
    profileId: ev.profileId,
    map: ev.map !== undefined ? ev.map : (prev?.map ?? null),
    mode: ev.mode !== undefined ? ev.mode : (prev?.mode ?? null),
    round: ev.round ?? prev?.round ?? 0,
    side: ev.side !== undefined ? ev.side : (prev?.side ?? null),
    score: ev.score ?? prev?.score ?? { ally: 0, enemy: 0 },
    roster: (ev.roster as LiveRosterPlayer[] | undefined) ?? prev?.roster ?? [],
    updatedAt: Date.now(),
  };
  if (ev.kind === "match_end") {
    states.delete(ev.profileId);
  } else {
    states.set(ev.profileId, next);
  }
  return next;
}

function broadcast(profileId: string, state: LiveMatchState | null) {
  const subs = subscribers.get(profileId);
  if (!subs) return;
  const msg = JSON.stringify({ type: "state", state });
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

export function startLiveServer(port = env().LIVE_WS_PORT): WebSocketServer {
  const wss = new WebSocketServer({ port });
  log.info("live ws server listening", { port });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/ingest") {
      const token = url.searchParams.get("token") ?? "";
      const profileId = verifyPairingToken(token);
      if (!profileId) {
        ws.close(4001, "invalid pairing token");
        return;
      }
      log.info("companion connected", { profileId });
      ws.on("message", (raw) => {
        try {
          const parsed = EventSchema.safeParse(JSON.parse(String(raw)));
          if (!parsed.success || parsed.data.profileId !== profileId) return;
          const ev = parsed.data;

          if (ev.kind === "round_end") {
            // Real per-round telemetry, persisted for goal tracking — never
            // touches the in-memory live-match state.
            if (ev.map && ev.side && typeof ev.survivedSeconds === "number") {
              void recordRound({
                profileId: ev.profileId,
                playedAt: new Date(),
                map: ev.map,
                side: ev.side,
                operatorSlug: ev.operatorSlug ?? null,
                survivedSeconds: ev.survivedSeconds,
                died: ev.died ?? false,
                source: "companion",
              });
            }
            return;
          }

          const state = applyEvent(ev);
          broadcast(profileId, ev.kind === "match_end" ? null : state);
        } catch {
          /* malformed frames are dropped */
        }
      });
      ws.on("close", () => log.info("companion disconnected", { profileId }));
      return;
    }

    if (url.pathname === "/subscribe") {
      const profileId = url.searchParams.get("profileId") ?? "";
      if (!profileId) {
        ws.close(4000, "profileId required");
        return;
      }
      let set = subscribers.get(profileId);
      if (!set) {
        set = new Set();
        subscribers.set(profileId, set);
      }
      set.add(ws);
      ws.send(JSON.stringify({ type: "state", state: getLiveState(profileId) }));
      ws.on("close", () => {
        set!.delete(ws);
        if (!set!.size) subscribers.delete(profileId);
      });
      return;
    }

    ws.close(4004, "unknown path");
  });

  return wss;
}
