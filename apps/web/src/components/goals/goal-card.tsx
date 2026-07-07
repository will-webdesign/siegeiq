"use client";

import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import type { GoalProgress, GoalType } from "@siegeiq/shared/goal-types";
import { GOAL_LABELS } from "@siegeiq/shared/goal-types";
import { EvidenceCard } from "@/components/evidence-card";
import { EmptyState } from "@/components/ui";

/**
 * One complete learning-goal loop, end to end (docs/PHASE1_PLAN.md §Phase 2).
 * Server passes the initial progress read (or null if no goal exists yet);
 * this component only owns the "start goal" action and re-fetch.
 */
export function GoalCard({
  profileId,
  goalType = "reduce_early_deaths",
  initialProgress,
}: {
  profileId: string;
  goalType?: GoalType;
  initialProgress: GoalProgress | null;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [loading, setLoading] = useState(false);

  async function startGoal() {
    setLoading(true);
    try {
      const res = await fetch(`/api/players/${profileId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalType }),
      });
      const json = (await res.json()) as { data: GoalProgress | null };
      setProgress(json.data);
    } finally {
      setLoading(false);
    }
  }

  if (!progress) {
    return (
      <div className="glass flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Target size={22} className="text-accent" />
        <div className="text-base font-semibold">{GOAL_LABELS[goalType]}</div>
        <p className="max-w-md text-sm leading-relaxed text-ink-dim">
          SiegeIQ will track your average survival time, first-engagement timing, and where you die
          early. A baseline needs at least 15 recorded rounds — from the desktop companion, or demo
          data if you&rsquo;re browsing without one.
        </p>
        <button
          onClick={startGoal}
          disabled={loading}
          className="mt-1 flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-accent-hot px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          Start this goal
        </button>
      </div>
    );
  }

  if (progress.previousAverageSeconds === null) {
    return (
      <EmptyState
        title={GOAL_LABELS[progress.goalType]}
        body={`Goal started — waiting on ${15 - progress.baselineSampleSize} more rounds before SiegeIQ can compute a trustworthy baseline. Nothing is shown until then.`}
      />
    );
  }

  const improved = (progress.improvementSeconds ?? 0) > 0;
  const title =
    progress.currentAverageSeconds === null
      ? `${GOAL_LABELS[progress.goalType]} — baseline set, no rounds yet this period`
      : `${GOAL_LABELS[progress.goalType]} — ${improved ? "improving" : "no improvement yet"}`;

  return (
    <EvidenceCard
      title={title}
      severity={progress.currentAverageSeconds === null ? "neutral" : improved ? "positive" : "warning"}
      reason={
        progress.currentAverageSeconds !== null
          ? `Previous average: ${Math.round(progress.previousAverageSeconds)}s. Current average: ${Math.round(progress.currentAverageSeconds)}s (${improved ? "+" : ""}${Math.round(progress.improvementSeconds ?? 0)}s).`
          : undefined
      }
      source={progress.source}
      confidence={progress.confidence}
      evidence={progress.evidence}
      timestamp={progress.timestamp}
      dataType={progress.dataType}
      freshness={progress.freshness}
    />
  );
}
