/** Thin promise wrappers around overwolf.windows. No-ops in dev mode. */
import { owAvailable } from "./env";

export type WindowName = "background" | "desktop" | "ingame";

function obtain(name: WindowName): Promise<overwolf.windows.WindowInfo | null> {
  return new Promise((resolve) => {
    overwolf.windows.obtainDeclaredWindow(name, (res) =>
      resolve(res.success && res.window ? res.window : null),
    );
  });
}

export async function openWindow(name: WindowName): Promise<void> {
  if (!owAvailable()) return;
  const w = await obtain(name);
  if (!w) return;
  await new Promise<void>((resolve) => overwolf.windows.restore(w.id, () => resolve()));
}

export async function closeWindow(name: WindowName): Promise<void> {
  if (!owAvailable()) return;
  const w = await obtain(name);
  if (!w) return;
  await new Promise<void>((resolve) => overwolf.windows.close(w.id, () => resolve()));
}

export async function minimizeCurrent(): Promise<void> {
  if (!owAvailable()) return;
  overwolf.windows.getCurrentWindow((res) => {
    if (res.success && res.window) overwolf.windows.minimize(res.window.id, () => undefined);
  });
}

export async function closeCurrent(): Promise<void> {
  if (!owAvailable()) {
    window.close();
    return;
  }
  overwolf.windows.getCurrentWindow((res) => {
    if (res.success && res.window) overwolf.windows.close(res.window.id, () => undefined);
  });
}

export async function maximizeOrRestoreCurrent(): Promise<void> {
  if (!owAvailable()) return;
  overwolf.windows.getCurrentWindow((res) => {
    if (!res.success || !res.window) return;
    if (res.window.stateEx === "maximized") {
      overwolf.windows.restore(res.window.id, () => undefined);
    } else {
      overwolf.windows.maximize(res.window.id, () => undefined);
    }
  });
}

/** Custom titlebar drag support (frameless native windows). */
export function dragMoveCurrent(): void {
  if (!owAvailable()) return;
  overwolf.windows.getCurrentWindow((res) => {
    if (res.success && res.window) overwolf.windows.dragMove(res.window.id);
  });
}

export async function toggleWindow(name: WindowName): Promise<void> {
  if (!owAvailable()) return;
  const w = await obtain(name);
  if (!w) return;
  if (w.isVisible) {
    overwolf.windows.hide(w.id, () => undefined);
  } else {
    overwolf.windows.restore(w.id, () => undefined);
  }
}
