import { useEffect, useState } from "react";
import type { SessionFinding } from "@siegeiq/shared/goal-types";
import { api } from "@/api/client";
import { loadSettings } from "@/state/settings";
import { EmptyState, Panel, Pill } from "@/ui/components";
import { useAppState } from "@/state/use-app-state";

const KIND_TONE = { strength: "green", weakness: "red", recommendation: "blue" } as const;

export function SessionView() {
  const s = useAppState();
  const settings = loadSettings();
  const [findings, setFindings] = useState<SessionFinding[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.profileId) return;
    api
      .sessionReport(settings.profileId)
      .then((r) => {
        setFindings(r.data as SessionFinding[] | null);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.profileId]);

  return (
    <div className="col" style={{ gap: 14 }}>
      <h2 style={{ fontSize: 16 }}>Session report</h2>

      <Panel title="Live session (this sitting)">
        {s.sessionRounds.length > 0 ? (
          <div className="col" style={{ gap: 4 }}>
            {s.sessionRounds.map((r, i) => (
              <div className="spread" key={i}>
                <span className="small">
                  Round {r.round} {r.side ? `· ${r.side}` : ""}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="tiny mono muted">
                    {r.kills}K / {r.deaths}D
                  </span>
                  {r.won === null ? <Pill>?</Pill> : r.won ? <Pill tone="green">won</Pill> : <Pill tone="red">lost</Pill>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No rounds recorded yet this sitting">
            Rounds appear automatically while Rainbow Six is running.
          </EmptyState>
        )}
      </Panel>

      <Panel title="Last recorded session">
        {!settings.profileId ? (
          <EmptyState title="Link your account in Settings" />
        ) : error ? (
          <EmptyState title="Couldn't load report">{error}</EmptyState>
        ) : findings && findings.length > 0 ? (
          <div className="col" style={{ gap: 12 }}>
            {findings.map((f) => (
              <div key={f.title} className="col" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 8 }}>
                  <Pill tone={KIND_TONE[f.kind]}>{f.kind}</Pill>
                  <span className="small">{f.title}</span>
                </div>
                {f.reason ? <span className="small dim">{f.reason}</span> : null}
                <span className="tiny dim mono">
                  {Object.entries(f.evidence)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}{" "}
                  · {f.confidence} confidence · {f.dataType}
                </span>
              </div>
            ))}
          </div>
        ) : loaded ? (
          <EmptyState title="Not enough recorded rounds for a report">
            Session reports are built exclusively from recorded rounds — SiegeIQ won't summarize a session it didn't see.
          </EmptyState>
        ) : null}
      </Panel>
    </div>
  );
}
