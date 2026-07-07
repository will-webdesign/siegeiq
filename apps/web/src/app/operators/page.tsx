import type { Metadata } from "next";
import operatorsData from "@siegeiq/game-data/operators.json";
import { OperatorGrid } from "@/components/operators/operator-grid";
import { SectionHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Operator database",
  description:
    "Every Rainbow Six Siege operator: loadouts, abilities, speed/health, counters and roles.",
};

export default function OperatorsPage() {
  const ops = operatorsData;
  return (
    <div>
      <SectionHeader
        title="Operator database"
        sub={`${ops.length} operators · seed data vintage documented in src/data/README.md — pick/win/ban rates ship once a verified per-season source is wired (roadmap Phase 5).`}
      />
      <OperatorGrid />
    </div>
  );
}
