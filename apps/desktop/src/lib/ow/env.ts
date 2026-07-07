/**
 * Overwolf runtime detection. Every overwolf.* call in the app goes through
 * these helpers so the entire client also runs in a plain browser
 * ("development mode") with mocked game events.
 */
export function owAvailable(): boolean {
  return typeof window !== "undefined" && typeof (window as { overwolf?: unknown }).overwolf !== "undefined";
}

export type RuntimeMode = "overwolf" | "dev";

export function runtimeMode(): RuntimeMode {
  return owAvailable() ? "overwolf" : "dev";
}

/** R6 Siege Overwolf game class id. */
export const R6_GAME_ID = 10826;
