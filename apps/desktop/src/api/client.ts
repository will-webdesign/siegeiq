/**
 * Typed client for the SiegeIQ API service. The desktop app never talks to
 * Ubisoft or community APIs directly — all credentials, caching and failover
 * live server-side, so users install and play with zero configuration.
 */
import type {
  MapStat,
  OperatorStat,
  PlayerIdentity,
  SeasonBoards,
  SummaryStats,
  WeaponStat,
} from "@siegeiq/shared";
import type { GoalProgress } from "@siegeiq/shared/goal-types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

export interface Enveloped<T> {
  data: T;
  meta?: {
    source: string;
    fetchedAt: string;
    stale: boolean;
    demo: boolean;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<Enveloped<T>> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Enveloped<T>;
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body;
}

async function post<T>(path: string, payload: unknown): Promise<Enveloped<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Enveloped<T>;
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body;
}

export type Platform = "uplay" | "psn" | "xbl";

export const api = {
  baseUrl: BASE,
  health: async (): Promise<Record<string, unknown>> => {
    const res = await fetch(`${BASE}/api/health`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  },
  searchPlayer: (platform: Platform, name: string) =>
    get<PlayerIdentity[]>(`/api/players/search?platform=${platform}&name=${encodeURIComponent(name)}`),
  boards: (profileId: string, platform: Platform) =>
    get<SeasonBoards>(`/api/players/${profileId}/boards?platform=${platform}`),
  summary: (profileId: string, platform: Platform) =>
    get<SummaryStats>(`/api/players/${profileId}/summary?platform=${platform}`),
  operators: (profileId: string, platform: Platform) =>
    get<OperatorStat[]>(`/api/players/${profileId}/operators?platform=${platform}`),
  weapons: (profileId: string, platform: Platform) =>
    get<WeaponStat[]>(`/api/players/${profileId}/weapons?platform=${platform}`),
  maps: (profileId: string, platform: Platform) =>
    get<MapStat[]>(`/api/players/${profileId}/maps?platform=${platform}`),
  goals: (profileId: string) => get<GoalProgress | null>(`/api/players/${profileId}/goals`),
  createGoal: (profileId: string, goalType: string) =>
    post<GoalProgress | null>(`/api/players/${profileId}/goals`, { goalType }),
  sessionReport: (profileId: string) =>
    get<unknown>(`/api/players/${profileId}/session-report`),
};
