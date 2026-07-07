import { owAvailable } from "../ow/env";
import { MockGepSource } from "./mock";
import { OverwolfGepSource } from "./real";
import type { GepSource } from "./types";

export * from "./types";
export { MockGepSource, OverwolfGepSource };

/** Real GEP inside Overwolf; scripted simulator in a plain browser. */
export function createGepSource(): GepSource {
  return owAvailable() ? new OverwolfGepSource() : new MockGepSource();
}
