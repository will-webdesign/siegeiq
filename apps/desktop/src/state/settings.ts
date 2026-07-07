/**
 * User settings. The ONLY user-provided values in the entire product are
 * Ubisoft username + platform (used when automatic detection is unavailable).
 * Persisted per-user; in Overwolf, localStorage of the background window
 * persists across sessions.
 */
export interface Settings {
  username: string;
  platform: "uplay" | "psn" | "xbl";
  profileId: string | null;
  overlayOnRoundResults: boolean;
}

const KEY = "siegeiq.settings.v1";

export const defaultSettings: Settings = {
  username: "",
  platform: "uplay",
  profileId: null,
  overlayOnRoundResults: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
