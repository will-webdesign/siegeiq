import { useState } from "react";
import type { PlayerIdentity } from "@siegeiq/shared";
import { api, type Platform } from "@/api/client";
import { loadSettings, saveSettings } from "@/state/settings";
import { Panel, Pill } from "@/ui/components";

export function SettingsView() {
  const [settings, setSettings] = useState(loadSettings());
  const [candidates, setCandidates] = useState<PlayerIdentity[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = () => {
    setBusy(true);
    setError(null);
    api
      .searchPlayer(settings.platform, settings.username.trim())
      .then((r) => setCandidates(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "search failed"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="col" style={{ gap: 14, maxWidth: 560 }}>
      <h2 style={{ fontSize: 16 }}>Settings</h2>

      <Panel title="Account">
        <div className="col" style={{ gap: 10 }}>
          <span className="small muted">
            The only thing SiegeIQ ever asks for: your Ubisoft username and platform. No API keys, no tokens, no
            configuration files — everything else is handled by SiegeIQ servers.
          </span>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="grow"
              placeholder="Ubisoft username"
              value={settings.username}
              onChange={(e) => setSettings({ ...settings, username: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && settings.username.trim().length >= 2 && search()}
            />
            <select
              value={settings.platform}
              onChange={(e) => setSettings({ ...settings, platform: e.target.value as Platform })}
            >
              <option value="uplay">PC</option>
              <option value="psn">PlayStation</option>
              <option value="xbl">Xbox</option>
            </select>
            <button className="primary" disabled={busy || settings.username.trim().length < 2} onClick={search}>
              {busy ? "Searching…" : "Link"}
            </button>
          </div>
          {error ? <span className="small" style={{ color: "var(--danger)" }}>{error}</span> : null}
          {candidates?.length === 0 ? <span className="small dim">No players found.</span> : null}
          {candidates?.map((c) => (
            <div className="spread" key={c.profileId}>
              <span className="row" style={{ gap: 8 }}>
                {c.username} <span className="tiny dim">{c.platform}</span>
                {settings.profileId === c.profileId ? <Pill tone="green">linked</Pill> : null}
              </span>
              <button
                onClick={() => {
                  const next = { ...settings, profileId: c.profileId, username: c.username };
                  setSettings(next);
                  saveSettings(next);
                }}
              >
                Use this account
              </button>
            </div>
          ))}
          {settings.profileId ? (
            <span className="tiny dim mono">profileId: {settings.profileId}</span>
          ) : null}
        </div>
      </Panel>

      <Panel title="Overlay">
        <div className="spread">
          <span className="small muted">Toggle in-game overlay</span>
          <span className="kbd">Ctrl+Shift+S</span>
        </div>
      </Panel>
    </div>
  );
}
