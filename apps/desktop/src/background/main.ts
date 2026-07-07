/**
 * Background window entry — Overwolf boots this first (start_window).
 *
 * The background window is the app's long-lived, invisible brain: it owns the
 * controller (state + services) and the WindowManager (window lifecycle), and
 * translates Overwolf lifecycle callbacks + hotkeys into bus commands. UI
 * windows never manage each other — they publish commands the manager here
 * carries out.
 */
import { SiegeIQController } from "./controller";
import { owAvailable } from "@/lib/ow/env";
import { openWindow } from "@/lib/ow/windows";
import { WindowManager, sendWindowCommand } from "@/services/window-manager";
import { HOTKEY_TOGGLE_OVERLAY, onHotkey } from "@/lib/ow/hotkeys";
import { createLogger } from "@/core/log";

const log = createLogger("boot");

async function boot() {
  const controller = new SiegeIQController();
  window.siegeiq = controller;
  await controller.start();

  if (!owAvailable()) return; // dev harness: pages run standalone

  const windows = new WindowManager(controller.bus);
  windows.start();

  // Manual launch → desktop window; game launch → overlay only (managed below).
  overwolf.extensions.onAppLaunchTriggered.addListener((e) => {
    if (e?.origin !== "gamelaunchevent") void windows.open("desktop");
  });

  // Show/retire the overlay as the game starts and stops.
  let wasRunning = false;
  controller.store.subscribe((s) => {
    if (s.gameRunning !== wasRunning) {
      wasRunning = s.gameRunning;
      void windows.onGameRunningChanged(s.gameRunning);
    }
  });

  overwolf.games.getRunningGameInfo((info) => {
    if (!(info && info.isRunning)) void openWindow("desktop");
  });

  onHotkey(HOTKEY_TOGGLE_OVERLAY, () => {
    controller.toggleOverlay();
    sendWindowCommand({ type: "toggle-overlay" });
  });

  log.info("SiegeIQ background ready");
}

void boot();
