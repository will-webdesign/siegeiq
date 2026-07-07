/**
 * Evidence Card — the atomic UI unit for anything SiegeIQ claims.
 * Renders: the statement, WHY (evidence rows), confidence, data type
 * (observed/calculated/inferred), source and timestamp. If an insight can't
 * fill these fields it doesn't get rendered anywhere in the product.
 */
import type { Insight } from "@siegeiq/coaching/insights/engine";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

const toneFor = { positive: "green", warning: "orange", neutral: "blue" } as const;

function SeverityIcon({ severity }: { severity: Insight["severity"] }) {
  const common = { size: 15, strokeWidth: 2 };
  if (severity === "positive") return <CheckCircle2 {...common} color="var(--positive)" />;
  if (severity === "warning") return <AlertTriangle {...common} color="var(--warning)" />;
  return <Info {...common} color="var(--info)" />;
}

export function EvidenceCard({ insight }: { insight: Insight }) {
  const evidence = Object.entries(insight.evidence);
  return (
    <div className="panel fade-in" style={{ padding: "10px 12px" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        <div style={{ paddingTop: 1 }}>
          <SeverityIcon severity={insight.severity} />
        </div>
        <div className="col grow" style={{ gap: 6 }}>
          <span style={{ fontSize: 13 }}>{insight.text}</span>
          {evidence.length > 0 ? (
            <div className="col" style={{ gap: 2 }}>
              {evidence.map(([k, v]) => (
                <span key={k} className="tiny dim mono">
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          ) : null}
          <div className="row wrap" style={{ gap: 6 }}>
            <span className={`pill ${toneFor[insight.severity]}`}>{insight.confidence} confidence</span>
            <span className="pill">{insight.dataType}</span>
            <span className="tiny dim">
              {insight.source} · {insight.freshness}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
