import type { Insight } from "@siegeiq/coaching/insights/engine";
import { EmptyState } from "@/components/ui";
import { EvidenceCard } from "@/components/evidence-card";

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (!insights.length) {
    return (
      <EmptyState
        title="Not enough data for insights"
        body="The coach requires minimum sample sizes before it says anything (e.g. 15+ rounds per map, 20+ per operator). Play more, refresh, and it will start talking."
      />
    );
  }
  return (
    <div className="space-y-3">
      {insights.map((ins) => (
        <EvidenceCard
          key={ins.id}
          title={ins.text}
          severity={ins.severity}
          source={ins.source}
          confidence={ins.confidence}
          evidence={ins.evidence}
          timestamp={ins.timestamp}
          dataType={ins.dataType}
          freshness={ins.freshness}
        />
      ))}
    </div>
  );
}
