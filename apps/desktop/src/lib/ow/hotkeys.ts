/** Hotkey registration — names must match manifest.json "hotkeys". */
import { owAvailable } from "./env";

export const HOTKEY_TOGGLE_OVERLAY = "siegeiq_toggle_overlay";

export function onHotkey(name: string, cb: () => void): void {
  if (!owAvailable()) return;
  overwolf.settings.hotkeys.onPressed.addListener((e) => {
    if (e.name === name) cb();
  });
}

export function getHotkeyBinding(name: string): Promise<string | null> {
  if (!owAvailable()) return Promise.resolve(null);
  return new Promise((resolve) => {
    overwolf.settings.hotkeys.get((res) => {
      if (!res.success) return resolve(null);
      const all = [...(res.games?.[10826] ?? []), ...(res.globals ?? [])];
      resolve(all.find((h) => h.name === name)?.binding ?? null);
    });
  });
}
