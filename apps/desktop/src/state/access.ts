/**
 * Window ↔ controller wiring.
 * Overwolf: the background window owns THE controller; UI windows reach it
 * through overwolf.windows.getMainWindow(). Dev mode: each page runs its own
 * controller with the mock GEP source.
 */
import { owAvailable } from "@/lib/ow/env";
import { SiegeIQController } from "@/background/controller";

declare global {
  interface Window {
    siegeiq?: SiegeIQController;
  }
}

let local: SiegeIQController | null = null;

export function getController(): SiegeIQController {
  if (owAvailable()) {
    const main = overwolf.windows.getMainWindow() as Window;
    if (main.siegeiq) return main.siegeiq;
    // Background not booted yet — extremely rare; fall through to local.
  }
  if (!local) {
    local = new SiegeIQController();
    void local.start();
  }
  return local;
}
