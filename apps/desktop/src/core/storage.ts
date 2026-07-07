/**
 * Persisted key/value storage.
 *
 * In Overwolf, the background window's localStorage persists across game
 * sessions and app restarts, so it's the natural home for settings and the
 * cached content manifest. This wrapper is null-safe (SSR / locked-down
 * contexts) and namespaced, and JSON-encodes values.
 */
import { createLogger } from "./log";

const log = createLogger("storage");
const NS = "siegeiq";

function backing(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const store = backing();
  if (!store) return fallback;
  try {
    const raw = store.getItem(`${NS}.${key}`);
    return raw ? ({ ...(fallback as object), ...(JSON.parse(raw) as object) } as T) : fallback;
  } catch (err) {
    log.warn(`failed to read "${key}"`, err);
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  const store = backing();
  if (!store) return;
  try {
    store.setItem(`${NS}.${key}`, JSON.stringify(value));
  } catch (err) {
    log.warn(`failed to write "${key}"`, err);
  }
}

export function remove(key: string): void {
  backing()?.removeItem(`${NS}.${key}`);
}
