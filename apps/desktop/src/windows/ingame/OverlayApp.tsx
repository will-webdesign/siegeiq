/**
 * In-game overlay — compact, readable at a glance, never blocks gameplay
 * information. Transparent window, draggable header, hotkey-toggleable.
 * Shows only evidence-backed calls; silence over speculation.
 */
import { useEffect, useState } from "react";
import type { MapStat, OperatorStat } from "@siegeiq/shared";
import { liveCoachInsights } from "@siegeiq/coaching/insights/live-coach";
import { findMap } from "@siegeiq/game-data";
import { api } from "@/api/client";
import { loadSettings } from "@/state/settings";
import { dragMoveCurrent } from "@/lib/ow/windows";
import { useAppState } from "@/state/use-app-state";
import { Pill } from "@/ui/components";
import { useToasts } from "@/ui/useToasts";
import { ToastStack } from "@/ui/ToastStack";

export function OverlayApp() {
  const s = useAppState();
  const settings = loadSettings();
  const { toasts, dismiss } = useToasts();
  const [myStats, setMyStats] = useState<{ maps: MapStat[]; operators: OperatorStat[] }>({ maps: [], operators: [] });

  useEffect(() => {
    if (!settings.profileId) return;
    Promise.all([api.maps(settings.profileId, settings.platform), api.operators(settings.profileId, settings.platform)])
      .then(([m, o]) => setMyStats({ maps: m.data, operators: o.data }))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.profileId]);

  const live = s.live;
  const insights = live ? liveCoachInsights({ live, myMaps: myStats.maps, myOperators: myStats.operators }) : [];
  const top = insights.slice(0, 3);

  const card = s.overlayVisible ? (
    <div
      className="col"
      style={{
        margin: 8,
        gap: 0,
        background: "rgba(11, 13, 16, 0.92)",
        border: "1px solid var(--line-strong)",
        borderRadius: 6,
        overflow: "hidden",
        maxHeight: "calc(100vh - 16px)",
      }}
    >
      <div
        className="spread"
        style={{ padding: "6px 10px", background: "var(--bg-1)", borderBottom: "1px solid var(--line)", cursor: "move" }}
        onMouseDown={() => dragMoveCurrent()}
      >
        <span style={{ fontWeight: 700, fontSize: 12 }}>
          SIEGE<span style={{ color: "var(--accent)" }}>IQ</span>
        </span>
        <span className="row" style={{ gap: 6 }}>
          {live ? (
            <>
              <span className="tiny mono">
                <span style={{ color: "var(--positive)" }}>{live.score.ally}</span>
                <span className="dim">:</span>
                <span style={{ color: "var(--danger)" }}>{live.score.enemy}</span>
              </span>
              {s.side ? <Pill tone={s.side === "attacker" ? "blue" : "orange"}>{s.side}</Pill> : null}
            </>
          ) : (
            <span className="tiny dim">waiting</span>
          )}
          <span className="kbd">Ctrl⇧S</span>
        </span>
      </div>

      <div className="col" style={{ padding: 10, gap: 8, overflow: "auto" }}>
        {live ? (
          <span className="tiny dim">
            {live.map ? (findMap(live.map)?.name ?? live.map) : "map unknown"} · round {live.round}
          </span>
        ) : (
          <span className="tiny dim">
            {s.mode === "dev" ? "Simulated match starting…" : "Match data appears when a round begins."}
          </span>
        )}

        {top.map((i) => (
          <div key={i.id} className="col" style={{ gap: 3, borderLeft: `2px solid ${i.severity === "warning" ? "var(--warning)" : i.severity === "positive" ? "var(--positive)" : "var(--info)"}`, paddingLeft: 8 }}>
            <span style={{ fontSize: 12 }}>{i.text}</span>
            <span className="tiny dim">
              {i.confidence} confidence · {i.dataType}
            </span>
          </div>
        ))}

        {live && top.length === 0 ? (
          <span className="tiny dim">No evidence-backed calls yet — the coach won't guess.</span>
        ) : null}

        {s.killFeed.length > 0 ? (
          <div className="col" style={{ gap: 2, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
            {s.killFeed.slice(-4).reverse().map((k) => (
              <span key={k.at + k.text} className="tiny mono dim">
                {k.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <>
      {card}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
