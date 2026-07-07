/**
 * WindowManager — owns the lifecycle of the app's declared windows.
 *
 * The background window (start_window) is long-lived and invisible. This
 * service decides when the desktop and in-game windows are shown, tracks their
 * intended visibility, and reacts to game state so the overlay appears with
 * the match and gets out of the way otherwise. UI windows never manage each
 * other directly — they publish `command` events on the bus and this service,
 * running in the background, carries them out.
 */
import { createLogger } from "@/core/log";
import { getBus, type AppBus } from "@/core/bus";
import { owAvailable } from "@/lib/ow/env";
import { openWindow, closeWindow, toggleWindow, type WindowName } from "@/lib/ow/windows";

const log = createLogger("windows");

export class WindowManager {
  private readonly bus: AppBus;
  private overlayWanted = false;
  private gameRunning = false;
  private disposers: Array<() => void> = [];

  constructor(bus: AppBus = getBus()) {
    this.bus = bus;
  }

  /** Wire command handling. Call once from the background window. */
  start(): void {
    const off = this.bus.on("command", (cmd) => void this.handle(cmd));
    this.disposers.push(off);
    log.info("window manager started");
  }

  stop(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  async open(name: WindowName): Promise<void> {
    if (name === "ingame") this.overlayWanted = true;
    await openWindow(name);
  }

  async close(name: WindowName): Promise<void> {
    if (name === "ingame") this.overlayWanted = false;
    await closeWindow(name);
  }

  async toggle(name: WindowName): Promise<void> {
    if (name === "ingame") this.overlayWanted = !this.overlayWanted;
    await toggleWindow(name);
  }

  /**
   * React to game running state. When R6 launches we bring up the overlay;
   * when it closes we retire it and surface the desktop window so the player
   * lands somewhere useful.
   */
  async onGameRunningChanged(running: boolean): Promise<void> {
    if (running === this.gameRunning) return;
    this.gameRunning = running;
    if (running) {
      await this.open("ingame");
    } else {
      await this.close("ingame");
      if (owAvailable()) await this.open("desktop");
    }
  }

  private async handle(cmd: import("@/core/bus").WindowCommand): Promise<void> {
    switch (cmd.type) {
      case "open":
        await this.open(cmd.window);
        break;
      case "close":
        await this.close(cmd.window);
        break;
      case "toggle-overlay":
        await this.toggle("ingame");
        break;
    }
  }
}

/** Convenience for UI windows: ask the background manager to do something. */
export function sendWindowCommand(cmd: import("@/core/bus").WindowCommand): void {
  getBus().emit("command", cmd);
}
