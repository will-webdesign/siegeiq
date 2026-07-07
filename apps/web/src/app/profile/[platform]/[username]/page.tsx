import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PLATFORM_LABELS, seasonById, type Platform } from "@siegeiq/shared";
import { rankFromRp } from "@siegeiq/shared";
import { profileInsights, performanceScore } from "@siegeiq/coaching/insights/engine";
import {
  getBoards,
  getMaps,
  getMatches,
  getOperators,
  getProgression,
  getRankHistory,
  getSummary,
  getWeapons,
  searchPlayer,
} from "@siegeiq/server/services/player-service";
import { NotFoundError } from "@siegeiq/shared";
import { GlassCard, RankBadge, SectionHeader, SourceBadge, StatTile } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { RankHistoryChart, PerformanceBreakdown } from "@/components/charts";
import { StatsTabs } from "@/components/profile/stats-tabs";
import { MatchTimeline } from "@/components/profile/match-timeline";
import { InsightsPanel } from "@/components/profile/insights-panel";
import { SessionReport } from "@/components/profile/session-report";
import { GoalCard } from "@/components/goals/goal-card";
import { getGoalProgress } from "@siegeiq/server/coaching/engine";
import { getSessionReport } from "@siegeiq/server/coaching/session-report";
import { fmtDuration, pct, ratio, timeAgo } from "@siegeiq/shared";

export const revalidate = 120;

interface Params {
  platform: string;
  username: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username, platform } = await params;
  const name = decodeURIComponent(username);
  return {
    title: `${name} — R6 stats (${platform})`,
    description: `Rainbow Six Siege rank, K/D, operator stats and match history for ${name}.`,
  };
}

const VALID = new Set(["uplay", "psn", "xbl"]);

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  const p = await params;
  if (!VALID.has(p.platform)) notFound();
  const platform = p.platform as Platform;
  const username = decodeURIComponent(p.username);

  let identityRes;
  try {
    identityRes = await searchPlayer(platform, username);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const identity = identityRes.data[0];
  if (!identity) notFound();

  const profileId = identity.profileId;

  const [boards, summary, operators, weapons, maps, progression, history, matches, goalProgress, sessionReport] =
    await Promise.allSettled([
      getBoards(profileId, platform),
      getSummary(profileId, platform),
      getOperators(profileId, platform),
      getWeapons(profileId, platform),
      getMaps(profileId, platform),
      getProgression(profileId, platform),
      getRankHistory(profileId),
      getMatches(profileId),
      getGoalProgress(profileId, "reduce_early_deaths"),
      getSessionReport(profileId),
    ]);

  const val = <T,>(r: PromiseSettledResult<T>): T | null =>
    r.status === "fulfilled" ? r.value : null;

  const boardsV = val(boards);
  const summaryV = val(summary);
  const operatorsV = val(operators);
  const weaponsV = val(weapons);
  const mapsV = val(maps);
  const progressionV = val(progression);
  const historyV = val(history) ?? [];
  const matchesV = val(matches) ?? [];
  const goalProgressV = val(goalProgress);
  const sessionReportV = val(sessionReport) ?? null;

  const ranked = boardsV?.data.boards.find((b) => b.board === "ranked") ?? null;
  const season = seasonById(boardsV?.data.seasonId ?? 0);
  const s = summaryV?.data ?? null;
  const insights = profileInsights({
    summary: s,
    operators: operatorsV?.data ?? [],
    maps: mapsV?.data ?? [],
    matches: matchesV,
    ctx: summaryV
      ? { source: summaryV.source, fetchedAt: summaryV.fetchedAt }
      : undefined,
  });
  const perf = performanceScore(s);
  const kd = s ? ratio(s.kills, s.deaths) : null;
  const wl = s ? s.wins / Math.max(1, s.wins + s.losses) : null;

  return (
    <div className="space-y-10">
      {/* Header */}
      <FadeIn>
        <GlassCard className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-violet/25 text-2xl font-bold">
              {identity.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{identity.username}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-dim">
                <span>{PLATFORM_LABELS[platform]}</span>
                {progressionV ? <span>· Level {progressionV.data.level}</span> : null}
                {progressionV ? (
                  <span>· {fmtDuration(progressionV.data.totalTimePlayedSeconds)} played</span>
                ) : null}
                <span>· {season.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {ranked ? <RankBadge rp={ranked.rankPoints} size="lg" /> : null}
            <div className="text-right">
              <SourceBadge
                source={boardsV?.source ?? identityRes.source}
                stale={boardsV?.stale}
                fetchedAt={boardsV ? timeAgo(boardsV.fetchedAt) : undefined}
              />
              {ranked ? (
                <div className="mt-2 text-xs text-ink-faint">
                  Peak {rankFromRp(ranked.maxRankPoints).name} ·{" "}
                  {ranked.maxRankPoints.toLocaleString()} RP
                </div>
              ) : null}
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Ranked board tiles */}
      {ranked ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Rank points" value={ranked.rankPoints.toLocaleString()} tone="accent" />
          <StatTile
            label="Season W–L"
            value={`${ranked.wins}–${ranked.losses}`}
            sub={pct(ranked.wins / Math.max(1, ranked.wins + ranked.losses), 0) + " win rate"}
          />
          <StatTile
            label="Season K/D"
            value={ratio(ranked.kills, ranked.deaths).toFixed(2)}
            tone={ratio(ranked.kills, ranked.deaths) >= 1 ? "win" : "loss"}
          />
          <StatTile label="Kills" value={ranked.kills.toLocaleString()} />
          <StatTile label="Deaths" value={ranked.deaths.toLocaleString()} />
          <StatTile
            label="Abandons"
            value={String(ranked.abandons)}
            tone={ranked.abandons > 2 ? "loss" : undefined}
          />
        </section>
      ) : null}

      {/* Overall summary tiles */}
      {s ? (
        <section>
          <SectionHeader
            title="Season summary"
            sub={`All queues · ${seasonById(s.seasonId).name}`}
            right={
              summaryV ? (
                <SourceBadge source={summaryV.source} stale={summaryV.stale} />
              ) : undefined
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Matches" value={s.matchesPlayed.toLocaleString()} />
            <StatTile label="K/D" value={(kd ?? 0).toFixed(2)} tone={(kd ?? 0) >= 1 ? "win" : "loss"} />
            <StatTile label="Win rate" value={pct(wl ?? 0, 0)} tone={(wl ?? 0) >= 0.5 ? "win" : "loss"} />
            <StatTile label="Headshot %" value={pct(s.headshotPct, 0)} />
            <StatTile
              label="Entry duels"
              value={`${s.openingKills}–${s.openingDeaths}`}
              sub="opening K–D"
              tone={s.openingKills >= s.openingDeaths ? "win" : "loss"}
            />
            <StatTile label="Plants / Defuses" value={`${s.plants} / ${s.defuses}`} />
          </div>
        </section>
      ) : null}

      {/* Rank graph + performance */}
      <section className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <SectionHeader
            title="Rank history"
            sub={
              historyV.length
                ? "Recorded by SiegeIQ at every refresh — history begins when a player is first tracked."
                : undefined
            }
          />
          {historyV.length ? (
            <RankHistoryChart data={historyV} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-dim">
              No snapshots yet. Ubisoft only exposes the current season, so SiegeIQ builds this
              graph from its own recordings — starting now.
            </p>
          )}
        </GlassCard>
        <GlassCard>
          <SectionHeader title="Performance score" sub="Transparent weighting, no black box" />
          {perf.score > 0 ? (
            <>
              <div className="text-gradient text-5xl font-bold tabular-nums">{perf.score}</div>
              <div className="mb-2 mt-1 text-xs text-ink-faint">out of 100</div>
              <PerformanceBreakdown parts={perf.parts} />
            </>
          ) : (
            <p className="text-sm text-ink-dim">Needs 20+ rounds this season.</p>
          )}
        </GlassCard>
      </section>

      {/* Insights */}
      <section>
        <SectionHeader
          title="Coach insights"
          sub="Only claims the data supports — every insight shows its evidence."
        />
        <InsightsPanel insights={insights} />
      </section>

      {/* Learning goal */}
      <section>
        <SectionHeader
          title="Learning goal"
          sub="One goal, tracked end to end — from real rounds to measured progress."
        />
        <GoalCard profileId={profileId} initialProgress={goalProgressV} />
      </section>

      {/* Session report */}
      <section>
        <SectionHeader
          title="Session report"
          sub="Strengths, weaknesses, and one recommendation — every sentence tied to this session's rounds."
        />
        <SessionReport findings={sessionReportV} />
      </section>

      {/* Detailed tables */}
      <section>
        <SectionHeader
          title="Operators · Weapons · Maps"
          right={
            operatorsV ? (
              <SourceBadge source={operatorsV.source} stale={operatorsV.stale} />
            ) : undefined
          }
        />
        <StatsTabs
          operators={operatorsV?.data ?? []}
          weapons={weaponsV?.data ?? []}
          maps={mapsV?.data ?? []}
        />
      </section>

      {/* Matches */}
      <section>
        <SectionHeader
          title="Recent matches"
          sub="Reconstructed from RP deltas between refreshes — full telemetry requires the desktop companion."
        />
        <MatchTimeline matches={matchesV} />
      </section>
    </div>
  );
}
