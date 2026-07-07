import type { MatchRow } from "@siegeiq/server/services/player-service";
import { cn, timeAgo } from "@siegeiq/shared";
import { EmptyState } from "@/components/ui";

export function MatchTimeline({ matches }: { matches: MatchRow[] }) {
  if (!matches.length) {
    return (
      <EmptyState
        title="No matches recorded yet"
        body="Ubisoft provides no match-history endpoint — SiegeIQ reconstructs matches from rank-point changes between profile refreshes. Check back after this player's next session (or connect the desktop companion for full match telemetry)."
      />
    );
  }
  return (
    <div className="glass divide-y divide-line/60 overflow-hidden">
      {matches.map((m, i) => {
        const good = m.outcome === "win";
        return (
          <div
            key={`${m.playedAt}-${i}`}
            className={cn(
              "flex items-center gap-4 px-4 py-3",
              good ? "border-l-2 border-l-win" : "border-l-2 border-l-loss",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                good ? "bg-win/10 text-win" : "bg-loss/10 text-loss",
              )}
            >
              {m.outcome === "win" ? "W" : m.outcome === "loss" ? "L" : "AB"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium capitalize">{m.board}</span>
                {m.confidence === "low" ? (
                  <span
                    className="rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-faint"
                    title="Several matches happened between profile refreshes; per-match numbers are session averages."
                  >
                    session avg
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-ink-faint">{timeAgo(m.playedAt)}</div>
            </div>
            <div className="hidden text-right text-xs text-ink-dim sm:block">
              <div className="tabular-nums">
                {m.kills} / {m.deaths}
              </div>
              <div className="text-ink-faint">K / D</div>
            </div>
            <div
              className={cn(
                "w-20 text-right text-sm font-semibold tabular-nums",
                m.rpDelta >= 0 ? "text-win" : "text-loss",
              )}
            >
              {m.rpDelta >= 0 ? "+" : ""}
              {m.rpDelta} RP
            </div>
          </div>
        );
      })}
    </div>
  );
}
