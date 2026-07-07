import { useState } from "react";
import { Activity, Crosshair, Gauge, Radio, Settings2, Target } from "lucide-react";
import { Titlebar } from "@/ui/Titlebar";
import { useAppState } from "@/state/use-app-state";
import { DashboardView } from "./views/DashboardView";
import { LiveMatchView } from "./views/LiveMatchView";
import { GoalsView } from "./views/GoalsView";
import { SessionView } from "./views/SessionView";
import { DiagnosticsView } from "./views/DiagnosticsView";
import { SettingsView } from "./views/SettingsView";

type ViewId = "dashboard" | "live" | "goals" | "session" | "diagnostics" | "settings";

const NAV: Array<{ id: ViewId; label: string; icon: typeof Gauge }> = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "live", label: "Live Match", icon: Radio },
  { id: "goals", label: "Learning Goals", icon: Target },
  { id: "session", label: "Session Report", icon: Activity },
  { id: "diagnostics", label: "Diagnostics", icon: Crosshair },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function App() {
  const [view, setView] = useState<ViewId>("dashboard");
  const s = useAppState();

  return (
    <div className="col" style={{ height: "100%", gap: 0 }}>
      <Titlebar />
      <div className="row grow" style={{ alignItems: "stretch", gap: 0, minHeight: 0 }}>
        <nav
          className="col"
          style={{
            width: 200,
            padding: 10,
            gap: 2,
            borderRight: "1px solid var(--line)",
            background: "var(--bg-1)",
            flexShrink: 0,
          }}
        >
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className="ghost row"
              onClick={() => setView(id)}
              style={{
                justifyContent: "flex-start",
                gap: 10,
                padding: "8px 10px",
                color: view === id ? "var(--text-0)" : "var(--text-1)",
                background: view === id ? "var(--bg-3)" : "transparent",
                borderLeft: view === id ? "2px solid var(--accent)" : "2px solid transparent",
                borderRadius: "0 var(--radius) var(--radius) 0",
              }}
            >
              <Icon size={15} />
              {label}
              {id === "live" && s.matchActive ? <span className="dot on" style={{ marginLeft: "auto" }} /> : null}
            </button>
          ))}
          <div className="grow" />
          <div className="col" style={{ gap: 4, padding: "8px 10px" }}>
            <span className="tiny dim row" style={{ gap: 6 }}>
              <span className={`dot ${s.gep.connected ? "on" : s.mode === "dev" ? "idle" : "off"}`} />
              {s.mode === "dev" ? "Development mode" : s.gep.connected ? "Game events live" : "Waiting for game"}
            </span>
          </div>
        </nav>
        <main className="grow" style={{ overflow: "auto", padding: 18 }}>
          {view === "dashboard" && <DashboardView />}
          {view === "live" && <LiveMatchView />}
          {view === "goals" && <GoalsView />}
          {view === "session" && <SessionView />}
          {view === "diagnostics" && <DiagnosticsView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
