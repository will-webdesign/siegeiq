/**
 * Diagnostic panel: Overwolf connection, detected game, raw event stream,
 * API/provider health. This is the first stop for TESTING.md verification
 * on a real Windows machine.
 */
import { useEffect, useState } from "react";
import { GAME_DATA_UPDATED, GAME_DATA_VERSION } from "@siegeiq/game-data";
import { api } from "@/api/client";
import { Panel, Pill, StatusDot } from "@/ui/components";
import { useAppState } from "@/state/use-app-state";

export function DiagnosticsView() {
  const s = useAppState();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .health()
        .then((h) => {
          setHealth(h);
          setHealthError(null);
        })
        .catch((e) => setHealthError(e instanceof Error ? e.message : "unreachable"));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const rows: Array<[string, React.ReactNode]> = [
    ["Runtime", <Pill key="r">{s.mode === "overwolf" ? "Overwolf" : "Browser (dev mode)"}</Pill>],
    ["Event source", <Pill key="s">{s.gep.source}</Pill>],
    [
      "GEP connection",
      <span className="row" key="c">
        <StatusDot state={s.gep.connected ? "on" : "off"} />
        <span className="small">{s.gep.connected ? "connected" : (s.gep.error ?? "not connected")}</span>
      </span>,
    ],
    [
      "Game detected",
      <span className="row" key="g">
        <StatusDot state={s.gameRunning ? "on" : "idle"} />
        <span className="small">{s.gameRunning ? "Rainbow Six Siege running" : "not running"}</span>
      </span>,
    ],
    ["Features requested", <span className="tiny mono" key="fr">{s.gep.featuresRequested.join(", ") || "—"}</span>],
    ["Features granted", <span className="tiny mono" key="fg">{s.gep.featuresGranted.join(", ") || "—"}</span>],
    [
      "Last event",
      <span className="small" key="le">
        {s.gep.lastEventAt ? new Date(s.gep.lastEventAt).toLocaleTimeString() : "never"}
      </span>,
    ],
    ["Game data", <span className="tiny mono" key="gd">{GAME_DATA_VERSION} · updated {GAME_DATA_UPDATED}</span>],
    ["API endpoint", <span className="tiny mono" key="ae">{api.baseUrl}</span>],
  ];

  return (
    <div className="col" style={{ gap: 14 }}>
      <h2 style={{ fontSize: 16 }}>Diagnostics</h2>

      <Panel title="Runtime & game events">
        <div className="col" style={{ gap: 8 }}>
          {rows.map(([k, v]) => (
            <div className="spread" key={k}>
              <span className="small dim">{k}</span>
              {v}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="SiegeIQ service health">
        {healthError ? (
          <span className="small" style={{ color: "var(--danger)" }}>
            API unreachable: {healthError}
          </span>
        ) : health ? (
          <pre className="tiny mono" style={{ margin: 0, whiteSpace: "pre-wrap", userSelect: "text" }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : (
          <span className="small dim">checking…</span>
        )}
      </Panel>

      <Panel title={`Raw event log (${s.eventLog.length})`}>
        <div className="col" style={{ gap: 2, maxHeight: 260, overflow: "auto" }}>
          {[...s.eventLog].reverse().map((e) => (
            <span key={e.at + e.event.type} className="tiny mono muted" style={{ userSelect: "text" }}>
              {new Date(e.at).toLocaleTimeString()} {JSON.stringify(e.event)}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
