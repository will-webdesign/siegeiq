/** Standard API response envelope: { data, meta } — mirrors docs/ARCHITECTURE.md §9. */
import { isDemoMode } from "@siegeiq/server/env";
import { NotFoundError, ProviderUnavailableError } from "@siegeiq/shared";
import type { Sourced } from "@siegeiq/server/services/player-service";
import type { FastifyReply } from "fastify";

export function ok<T>(reply: FastifyReply, s: Sourced<T>, extraMeta: Record<string, unknown> = {}) {
  return reply
    .header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120")
    .send({
      data: s.data,
      meta: {
        source: s.source,
        fetchedAt: new Date(s.fetchedAt).toISOString(),
        stale: s.stale,
        demo: isDemoMode(),
        ...extraMeta,
      },
    });
}

export function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof NotFoundError) {
    return reply.status(404).send({ error: err.message });
  }
  // Upstream (Ubisoft) is rate-limited / circuit-open and there is no
  // r6data/demo fallback available. This is an EXPECTED, transient state for a
  // single-burner-account setup — not a server bug. Return 503 + Retry-After so
  // the frontend can render a friendly "live data temporarily unavailable, try
  // again shortly" banner rather than a scary error, and never mistake it for a
  // permanent failure. `unavailable: true` gives the client a stable flag to
  // branch on without string-matching the message.
  if (err instanceof ProviderUnavailableError) {
    return reply
      .status(503)
      .header("Retry-After", "120")
      .send({ error: "Live data is temporarily unavailable. Please try again shortly.", unavailable: true });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return reply.status(502).send({ error: message });
}

const VALID_PLATFORMS = new Set(["uplay", "psn", "xbl"]);
export function parsePlatform(v: unknown): "uplay" | "psn" | "xbl" | null {
  return typeof v === "string" && VALID_PLATFORMS.has(v) ? (v as "uplay" | "psn" | "xbl") : null;
}
