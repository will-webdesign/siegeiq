import { isDemoMode, providerOrder } from "@siegeiq/server/env";
import { logger } from "@siegeiq/shared";
import { CircuitBreaker } from "@siegeiq/server/circuit";
import type { FullProvider } from "@siegeiq/shared";
import { NotFoundError, ProviderUnavailableError } from "@siegeiq/shared";
import { ubisoftProvider } from "./ubisoft/provider";
import { r6dataProvider } from "./r6data";
import { demoProvider } from "./demo";

const log = logger("providers");

const ALL: Record<string, FullProvider> = {
  ubisoft: ubisoftProvider,
  r6data: r6dataProvider,
  demo: demoProvider,
};

const breakers = new Map<string, CircuitBreaker>();
function breakerFor(id: string): CircuitBreaker {
  let b = breakers.get(id);
  if (!b) {
    // Single-burner-account posture (see docs/RESEARCH.md §2.1): the `ubisoft`
    // provider is backed by ONE shared account with no failover to a second
    // Ubisoft account. When it starts failing (429s / 5xx), continuing to hit it
    // risks escalating from a temporary rate-limit to a ban that takes the whole
    // app offline. So we err toward tripping EARLY and backing off LONG:
    //   - threshold 3 (was 4): open after 3 consecutive failures, one sooner.
    //   - cooldown 120s (was 60s): give Ubisoft twice as long to cool off before
    //     the half-open probe. A slightly staler response (served from cache or
    //     the r6data/demo fallback) is always cheaper than losing the account.
    // r6data/demo are cheap/local and could tolerate looser settings, but a
    // uniform conservative policy keeps behavior predictable and is safe for all.
    b = new CircuitBreaker(3, 120_000);
    breakers.set(id, b);
  }
  return b;
}

export interface ProviderResult<T> {
  data: T;
  source: string;
}

/** Active chain given env: demo mode pins demo; otherwise PROVIDER_ORDER
 *  filtered to configured providers, with demo appended only if listed. */
export function activeProviders(): FullProvider[] {
  if (isDemoMode()) return [demoProvider];
  const order = providerOrder();
  const chain = order.map((id) => ALL[id]).filter((p): p is FullProvider => Boolean(p));
  return chain.filter((p) => p.configured());
}

/**
 * Run `fn` against the provider chain with failover. NotFound is a real
 * answer (the player doesn't exist) — it does NOT trigger failover.
 */
export async function withFailover<T>(
  op: string,
  fn: (p: FullProvider) => Promise<T>,
): Promise<ProviderResult<T>> {
  const chain = activeProviders();
  if (!chain.length) {
    throw new Error(
      "No data providers configured. Set UBI_EMAIL/UBI_PASSWORD or R6DATA_API_KEY, or enable DEMO_MODE.",
    );
  }
  let lastErr: unknown;
  let anyAttempted = false;
  for (const p of chain) {
    const breaker = breakerFor(p.id);
    if (!breaker.canRequest()) {
      log.debug("circuit open, skipping", { provider: p.id, op });
      continue;
    }
    anyAttempted = true;
    try {
      const data = await fn(p);
      breaker.recordSuccess();
      return { data, source: p.id };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      lastErr = err;
      if (!(err instanceof ProviderUnavailableError)) breaker.recordFailure();
      log.warn("provider failed, trying next", { provider: p.id, op, error: String(err) });
    }
  }
  // Every provider in the chain had its circuit open (no attempt made). With a
  // single burner account and no configured r6data/demo fallback this is the
  // common "Ubisoft is unhappy, back off" path. Surface it as an explicit
  // ProviderUnavailableError so the API layer can return a clean 503 + Retry-After
  // ("data temporarily unavailable") banner instead of a raw 502 — and crucially
  // so we never present stale data as if it were fresh.
  if (!anyAttempted) {
    throw new ProviderUnavailableError(
      chain.map((p) => p.id).join(","),
      "all providers circuit-open (upstream backing off)",
    );
  }
  throw lastErr ?? new ProviderUnavailableError("none", `all providers failed for ${op}`);
}

export function providerHealth() {
  return Object.values(ALL).map((p) => ({
    id: p.id,
    label: p.label,
    official: p.official,
    configured: p.configured(),
    active: activeProviders().some((a) => a.id === p.id),
    circuit: breakerFor(p.id).snapshot(),
  }));
}
