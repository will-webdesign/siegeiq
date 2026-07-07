import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import type { Provenance } from "@siegeiq/shared";
import { cn } from "@siegeiq/shared";
import { timeAgo } from "@siegeiq/shared";

/**
 * EvidenceCard — the one reusable primitive every coaching recommendation,
 * insight, and goal-progress readout renders through (docs/PHASE1_PLAN.md §4).
 * Every prop maps directly to the universal provenance shape: nothing is
 * shown here that the caller can't back with a source, a confidence level,
 * and the evidence that produced it.
 */
export interface EvidenceCardProps extends Provenance {
  title: string;
  reason?: string;
  severity?: "positive" | "neutral" | "warning";
}

const DATA_TYPE_LABEL: Record<Provenance["dataType"], string> = {
  observed: "Observed",
  calculated: "Calculated",
  inferred: "Inferred",
};

const SOURCE_LABEL: Record<string, string> = {
  demo: "Demo data",
  ubisoft: "Ubisoft",
  r6data: "R6Data",
  "siegeiq-live-coach": "SiegeIQ live coach",
  "siegeiq-telemetry": "SiegeIQ match telemetry",
  "siegeiq-goals": "SiegeIQ goal tracking",
};

export function EvidenceCard({
  title,
  reason,
  severity = "neutral",
  source,
  confidence,
  evidence,
  timestamp,
  dataType,
  freshness,
}: EvidenceCardProps) {
  const evidenceEntries = Object.entries(evidence);
  return (
    <div
      className={cn(
        "glass flex gap-3 px-4 py-3.5",
        severity === "positive" && "border-win/25",
        severity === "warning" && "border-loss/25",
      )}
    >
      {severity === "positive" ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-win" />
      ) : severity === "warning" ? (
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-loss" />
      ) : (
        <Info size={18} className="mt-0.5 shrink-0 text-cyan" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-relaxed">{title}</p>
        {reason ? <p className="mt-1 text-sm leading-relaxed text-ink-dim">{reason}</p> : null}

        {evidenceEntries.length ? (
          <ul className="mt-2 space-y-0.5">
            {evidenceEntries.map(([k, v]) => (
              <li key={k} className="text-xs text-ink-faint">
                <span className="text-ink-dim">•</span> {formatEvidenceKey(k)}:{" "}
                <span className="tabular-nums text-ink">{v}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/60 pt-2 text-[11px] text-ink-faint">
          <span>
            Source: <span className="text-ink-dim">{SOURCE_LABEL[source] ?? source}</span>
          </span>
          <span>
            Confidence:{" "}
            <span
              className={cn(
                confidence === "high" && "text-win",
                confidence === "medium" && "text-accent",
                confidence === "low" && "text-loss",
              )}
            >
              {confidence[0]!.toUpperCase() + confidence.slice(1)}
            </span>
          </span>
          <span>
            Type: <span className="text-ink-dim">{DATA_TYPE_LABEL[dataType]}</span>
          </span>
          <span title={new Date(timestamp).toLocaleString()}>
            Updated: <span className="text-ink-dim">{timeAgo(timestamp)}</span>
            {freshness === "stale" ? " (stale)" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatEvidenceKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
