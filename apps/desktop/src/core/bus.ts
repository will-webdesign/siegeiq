/**
 * App-wide message bus — the IPC backbone shared across all windows.
 *
 * Overwolf runs every window of an app in the same host process and lets a UI
 * window reach the background window's live JS objects via
 * `overwolf.windows.getMainWindow()`. We lean on that: the background window
 * creates ONE bus and stashes it on its global; every other window resolves
 * the same instance instead of holding its own. That gives us a single,
 * decoupled pub/sub channel — services publish, windows subscribe, and neither
 * side reaches into the other's internals.
 *
 * In a plain browser (dev harness) `getMainWindow()` is unavailable, so each
 * page falls back to a local bus that still drives the mock pipeline.
 */
import { Emitter } from "./events";
import { owAvailable } from "@/lib/ow/env";

export type ToastKind = "info" | "success" | "warning" | "coach";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  kind: ToastKind;
  /** Auto-dismiss after this many ms; 0 = sticky. */
  ttl: number;
}

export type WindowCommand =
  | { type: "open"; window: "desktop" | "ingame" }
  | { type: "close"; window: "desktop" | "ingame" }
  | { type: "toggle-overlay" };

export type SocketStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

/** The complete set of events that flow across windows. */
export interface AppEvents {
  /** A new immutable state snapshot from the background controller. */
  "state:changed": import("@/state/app-state").AppState;
  /** Show a transient notification (overlay toast and/or native). */
  "toast": Toast;
  /** UI → background window/overlay commands. */
  "command": WindowCommand;
  /** Content/patch data was refreshed to a new version. */
  "content:updated": { version: string };
  /** Live backend socket connection state changed. */
  "socket:status": SocketStatus;
}

export type AppBus = Emitter<AppEvents>;

interface BusHost extends Window {
  __siegeiqBus?: AppBus;
}

let localBus: AppBus | null = null;

/** The bus that lives on (or belongs to) the background window. */
export function getBus(): AppBus {
  if (owAvailable()) {
    try {
      const main = overwolf.windows.getMainWindow() as BusHost;
      if (main) {
        if (!main.__siegeiqBus) main.__siegeiqBus = new Emitter<AppEvents>();
        return main.__siegeiqBus;
      }
    } catch {
      // Background not booted yet — fall through to a local instance.
    }
  }
  if (!localBus) localBus = new Emitter<AppEvents>();
  return localBus;
}
