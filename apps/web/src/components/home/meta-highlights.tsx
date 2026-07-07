import Link from "next/link";
import operatorsData from "@siegeiq/game-data/operators.json";
import mapsData from "@siegeiq/game-data/maps.json";
import { GlassCard, SectionHeader } from "@/components/ui";

interface Op {
  slug: string;
  name: string;
  side: "attacker" | "defender";
  tags: string[];
}
interface MapRow {
  slug: string;
  name: string;
  lean: string;
}

/**
 * Meta highlights sourced from the in-repo database (static, honest about
 * provenance — see src/data/README.md). Pick/win/ban meta percentages are a
 * roadmap item pending a verified source; we do not fabricate them here.
 */
export function MetaHighlights() {
  const ops = operatorsData as unknown as Op[];
  const maps = mapsData as unknown as MapRow[];
  const hardBreach = ops.filter((o) => o.tags.includes("hardBreach"));
  const antiGadget = ops.filter((o) => o.tags.includes("antiGadget") && o.side === "attacker");
  const defLean = maps.filter((m) => m.lean === "defender");

  return (
    <section>
      <SectionHeader
        title="Know the meta"
        sub="From the SiegeIQ operator & map database — updated every season."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard hover>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-faint">
            Hard breach picks
          </div>
          <ul className="mt-3 space-y-2">
            {hardBreach.map((o) => (
              <li key={o.slug}>
                <Link href={`/operators/${o.slug}`} className="text-sm hover:text-accent">
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard hover>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-faint">
            Utility clear on attack
          </div>
          <ul className="mt-3 space-y-2">
            {antiGadget.slice(0, 6).map((o) => (
              <li key={o.slug}>
                <Link href={`/operators/${o.slug}`} className="text-sm hover:text-accent">
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard hover>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-faint">
            Defender-sided maps
          </div>
          <ul className="mt-3 space-y-2">
            {defLean.map((m) => (
              <li key={m.slug}>
                <Link href={`/maps/${m.slug}`} className="text-sm hover:text-accent">
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </section>
  );
}
