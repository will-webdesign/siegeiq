import type { SessionFinding } from "@siegeiq/shared/goal-types";
import { EvidenceCard } from "@/components/evidence-card";
import { EmptyState } from "@/components/ui";

const KIND_SEVERITY: Record<SessionFinding["kind"], "positive" | "warning" | "neutral"> = {
  strength: "positive",
  weakness: "warning",
  recommendation: "neutral",
};

/** Session Review (docs/PHASE1_PLAN.md §Phase 3) — strengths, weaknesses, and
 *  a recommendation, every sentence tied to this session's actual rounds.
 *  `findings === null` means below the round threshold; the empty state says
 *  so instead of inventing something to fill the space. */
export function SessionReport({ findings }: { findings: SessionFinding[] | null }) {
  if (findings === null) {
    return (
      <EmptyState
        title="Not enough rounds this session"
        body="SiegeIQ needs at least 8 rounds recorded in the last few hours before it will say anything about this session — it won't guess from a handful of rounds."
      />
    );
  }
  if (!findings.length) {
    return (
      <EmptyState
        title="Nothing stood out this session"
        body="Enough rounds were recorded, but nothing crossed the threshold for a strength, weakness, or recommendation — a quiet, unremarkable session by the numbers."
      />
    );
  }
  return (
    <div className="space-y-3">
      {findings.map((f, i) => (
        <EvidenceCard
          key={`${f.kind}-${i}`}
          title={f.title}
          reason={f.reason}
          severity={KIND_SEVERITY[f.kind]}
          source={f.source}
          confidence={f.confidence}
          evidence={f.evidence}
          timestamp={f.timestamp}
          dataType={f.dataType}
          freshness={f.freshness}
        />
      ))}
    </div>
  );
}
