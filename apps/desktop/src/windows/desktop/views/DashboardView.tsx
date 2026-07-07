import { useEffect, useState } from "react";
import type { PlayerIdentity, SeasonBoards, SummaryStats } from "@siegeiq/shared";
import { rankFromRp, seasonById } from "@siegeiq/shared";
import { api } from "@/api/client";
import { loadSettings } from "@/state/settings";
import { EmptyState, Panel, Pill, Stat } from "@/ui/components";
import { useAppState } from "@/state/use-app-state";

interface Loaded {
  identity: PlayerIdentity | null;
  boards: SeasonBoards | null;
  summary: SummaryStats | null;
  source: string | null;
  error: string | null;
}

export function DashboardView() {
  const s = useAppState();
  const settings = loadSettings();
  const [d, setD] = useState<Loaded>({ identity: null, boards: null, summary: null, source: null, error: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!settings.profileId) return;
      try {
        const [boards, summary] = await Promise.all([
          api.boards(settings.profileId, settings.platform),
          api.summary(settings.profileId, settings.platform),
        ]);
        if (!cancelled) {
          setD({
            identity: null,
            boards: boards.data,
            summary: summary.data,
            source: boards.meta?.source ?? null,
            error: null,
          });
        }
      } catch (e) {
        if (!cancelled) setD((p) => ({ ...p, error: e instanceof Error ? e.message : "Failed to load" }));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.profileId, settings.platform]);

  if (!settings.profileId) {
    return (
      <Panel title="Welcome to SiegeIQ">
        <EmptyState title="Link your Ubisoft account to begin">
          Open Settings and enter your Ubisoft username — that is the only setup SiegeIQ ever asks for.
          Stats, rank and coaching load automatically from there.
        </EmptyState>
      </Panel>
    );
  }

  const ranked = d.boards?.boards.find((b) => b.board === "ranked") ?? null;
  const rank = ranked ? rankFromRp(ranked.rankPoints) : null;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="spread">
        <h2 style={{ fontSize: 16 }}>{settings.username}</h2>
        <div className="row" style={{ gap: 6 }}>
          {d.boards ? <Pill tone="gold">{seasonById(d.boards.seasonId).name}</Pill> : null}
          {d.source ? <Pill>source: {d.source}</Pill> : null}
        </div>
      </div>

      {d.error ? (
        <Panel title="Data unavailable">
          <EmptyState title="Couldn't reach the SiegeIQ service">
            {d.error} — nothing is shown rather than showing stale or invented numbers. Check Diagnostics.
          </EmptyState>
        </Panel>
      ) : null}

      <div className="row wrap" style={{ gap: 14, alignItems: "stretch" }}>
        <Panel title="Ranked" className="grow">
          {ranked && rank ? (
            <div className="row wrap" style={{ gap: 26 }}>
              <Stat label="Rank" value={rank.name} sub={`${ranked.rankPoints} RP`} />
              <Stat label="W / L" value={`${ranked.wins} – ${ranked.losses}`} />
              <Stat
                label="Win rate"
                value={
                  ranked.wins + ranked.losses > 0
                    ? `${Math.round((ranked.wins / (ranked.wins + ranked.losses)) * 100)}%`
                    : "—"
                }
              />
              <Stat
                label="K/D"
                value={ranked.deaths > 0 ? (ranked.kills / ranked.deaths).toFixed(2) : String(ranked.kills)}
              />
            </div>
          ) : (
            <EmptyState title="No ranked data yet" />
          )}
        </Panel>
        <Panel title="This session" className="grow">
          {s.sessionRounds.length > 0 ? (
            <div className="row wrap" style={{ gap: 26 }}>
              <Stat label="Rounds" value={s.sessionRounds.length} />
              <Stat
                label="Round wins"
                value={s.sessionRounds.filter((r) => r.won === true).length}
              />
              <Stat label="Kills" value={s.sessionRounds.reduce((a, r) => a + r.kills, 0)} />
              <Stat label="Deaths" value={s.sessionRounds.reduce((a, r) => a + r.deaths, 0)} />
            </div>
          ) : (
            <EmptyState title="No rounds recorded this session">
              Round data appears here automatically while Rainbow Six is running.
            </EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
