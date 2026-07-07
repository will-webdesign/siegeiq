import { useEffect, useState } from "react";
import type { MapStat, OperatorStat } from "@siegeiq/shared";
import { liveCoachInsights } from "@siegeiq/coaching/insights/live-coach";
import { findMap, findOperator } from "@siegeiq/game-data";
import { api } from "@/api/client";
import { loadSettings } from "@/state/settings";
import { EmptyState, Panel, Pill } from "@/ui/components";
import { EvidenceCard } from "@/ui/EvidenceCard";
import { useAppState } from "@/state/use-app-state";

export function LiveMatchView() {
  const s = useAppState();
  const settings = loadSettings();
  const [myStats, setMyStats] = useState<{ maps: MapStat[]; operators: OperatorStat[] }>({ maps: [], operators: [] });

  useEffect(() => {
    if (!settings.profileId) return;
    let cancelled = false;
    Promise.all([api.maps(settings.profileId, settings.platform), api.operators(settings.profileId, settings.platform)])
      .then(([m, o]) => {
        if (!cancelled) setMyStats({ maps: m.data, operators: o.data });
      })
      .catch(() => {
        /* comp-only coaching still works without personal stats */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.profileId, settings.platform]);

  if (!s.live || !s.matchActive) {
    return (
      <Panel title="Live match">
        <EmptyState title={s.gameRunning ? "Waiting for a match" : "Rainbow Six is not running"}>
          {s.mode === "dev"
            ? "Development mode is running a simulated match — it will appear here in a few seconds."
            : "SiegeIQ attaches automatically when a match starts. Nothing to configure."}
        </EmptyState>
      </Panel>
    );
  }

  const live = s.live;
  const insights = liveCoachInsights({ live, myMaps: myStats.maps, myOperators: myStats.operators });
  const mapInfo = live.map ? findMap(live.map) : undefined;
  const allies = live.roster.filter((r) => r.team === "ally");
  const enemies = live.roster.filter((r) => r.team === "enemy");

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="spread">
        <div className="row" style={{ gap: 8 }}>
          <h2 style={{ fontSize: 16 }}>{mapInfo?.name ?? live.map ?? "Unknown map"}</h2>
          {live.mode ? <Pill tone="gold">{live.mode}</Pill> : null}
          {s.side ? <Pill tone={s.side === "attacker" ? "blue" : "orange"}>{s.side}</Pill> : null}
          <Pill>round {live.round}</Pill>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700 }}>
          <span style={{ color: "var(--positive)" }}>{live.score.ally}</span>
          <span className="dim"> : </span>
          <span style={{ color: "var(--danger)" }}>{live.score.enemy}</span>
        </span>
      </div>

      <div className="row wrap" style={{ gap: 14, alignItems: "flex-start" }}>
        <Panel title="Rosters" className="grow">
          <div className="row" style={{ gap: 24, alignItems: "flex-start" }}>
            {[
              { label: "Your team", list: allies },
              { label: "Enemy team", list: enemies },
            ].map(({ label, list }) => (
              <div className="col grow" key={label} style={{ gap: 6 }}>
                <span className="section-title">{label}</span>
                {list.map((p) => {
                  const op = p.operatorSlug ? findOperator(p.operatorSlug) : undefined;
                  return (
                    <div className="spread" key={p.username} style={{ padding: "4px 0" }}>
                      <span className="row" style={{ gap: 8 }}>
                        <span>{p.username}</span>
                        {op ? <span className="tiny dim">{op.name}</span> : <span className="tiny dim">—</span>}
                      </span>
                      <span className="tiny mono muted">
                        {p.kills}/{p.deaths}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Panel>

        <div className="col" style={{ gap: 10, flexBasis: 380, flexGrow: 1 }}>
          <span className="section-title">Coach — every call shows its evidence</span>
          {insights.length > 0 ? (
            insights.map((i) => <EvidenceCard key={i.id} insight={i} />)
          ) : (
            <Panel>
              <EmptyState title="No calls yet">
                The coach only speaks when the full roster is known and the evidence threshold is met — it never guesses.
              </EmptyState>
            </Panel>
          )}
        </div>
      </div>

      <Panel title="Event feed">
        <div className="col" style={{ gap: 3, maxHeight: 180, overflow: "auto" }}>
          {[...s.killFeed].reverse().map((k) => (
            <span key={k.at + k.text} className="small mono muted">
              {new Date(k.at).toLocaleTimeString()} · {k.text}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
