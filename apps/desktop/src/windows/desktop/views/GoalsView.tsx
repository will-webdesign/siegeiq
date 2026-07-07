import { useCallback, useEffect, useState } from "react";
import { GOAL_LABELS, type GoalProgress } from "@siegeiq/shared/goal-types";
import { api } from "@/api/client";
import { loadSettings } from "@/state/settings";
import { EmptyState, Panel, Pill } from "@/ui/components";

const fmt = (s: number | null) => (s === null ? "—" : `${s.toFixed(1)}s`);

export function GoalsView() {
  const settings = loadSettings();
  const [goal, setGoal] = useState<GoalProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!settings.profileId) return;
    api
      .goals(settings.profileId)
      .then((r) => {
        setGoal(r.data);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!settings.profileId) {
    return (
      <Panel title="Learning goals">
        <EmptyState title="Link your account in Settings to set goals" />
      </Panel>
    );
  }

  const improving = goal?.improvementSeconds !== null && goal !== null && goal.improvementSeconds! > 0;

  return (
    <div className="col" style={{ gap: 14, maxWidth: 640 }}>
      <div className="spread">
        <h2 style={{ fontSize: 16 }}>Learning goals</h2>
        {loaded && !goal ? (
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              api
                .createGoal(settings.profileId!, "reduce_early_deaths")
                .then((r) => setGoal(r.data))
                .catch((e) => setError(e instanceof Error ? e.message : "failed"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Starting…" : "Start: reduce early deaths"}
          </button>
        ) : null}
      </div>

      {error ? (
        <Panel>
          <EmptyState title="Couldn't load goals">{error}</EmptyState>
        </Panel>
      ) : null}

      {goal ? (
        <Panel title={GOAL_LABELS[goal.goalType]}>
          <div className="col" style={{ gap: 12 }}>
            <div className="spread">
              <span className="small muted">
                Survive longer into rounds. Baseline vs. current average survival time, from recorded rounds only.
              </span>
              {goal.improvementSeconds !== null ? (
                <Pill tone={improving ? "green" : "red"}>
                  {improving ? "+" : ""}
                  {goal.improvementSeconds.toFixed(1)}s
                </Pill>
              ) : (
                <Pill>collecting data</Pill>
              )}
            </div>
            <div className="row wrap" style={{ gap: 24 }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="tiny dim">BASELINE AVG SURVIVAL</span>
                <span className="mono">{fmt(goal.previousAverageSeconds)}</span>
                <span className="tiny dim">{goal.baselineSampleSize} rounds</span>
              </div>
              <div className="col" style={{ gap: 2 }}>
                <span className="tiny dim">CURRENT AVG SURVIVAL</span>
                <span className="mono">{fmt(goal.currentAverageSeconds)}</span>
                <span className="tiny dim">{goal.sampleSize} rounds since baseline</span>
              </div>
              <div className="col" style={{ gap: 2 }}>
                <span className="tiny dim">STARTED</span>
                <span className="mono">{new Date(goal.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <span className="tiny dim">
              {goal.source} · {goal.dataType} · {goal.confidence} confidence ·{" "}
              {Object.entries(goal.evidence)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </span>
          </div>
        </Panel>
      ) : loaded ? (
        <Panel>
          <EmptyState title="No active goal">
            Goals are measured from real recorded rounds only. Start one and SiegeIQ establishes your baseline as rounds
            come in — no estimates, no filler.
          </EmptyState>
        </Panel>
      ) : null}
    </div>
  );
}
