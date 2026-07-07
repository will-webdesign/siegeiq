import type { Metadata } from "next";
import Link from "next/link";
import mapsData from "@siegeiq/game-data/maps.json";
import { SectionHeader } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion";
import { cn } from "@siegeiq/shared";

export const metadata: Metadata = {
  title: "Map database",
  description: "Rainbow Six Siege maps: bomb sites, side lean, best operators and strategy notes.",
};

interface MapRow {
  slug: string;
  name: string;
  location: string;
  released: string;
  ranked: boolean;
  sites: string[];
  lean: string;
}

export default function MapsPage() {
  const maps = mapsData as unknown as MapRow[];
  return (
    <div>
      <SectionHeader
        title="Map database"
        sub={`${maps.length} competitive maps · side lean reflects long-run community consensus, per-site win rates arrive with recorded match data (roadmap Phase 5).`}
      />
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" staggerMs={35}>
        {maps.map((m) => (
          <StaggerItem key={m.slug}>
            <Link href={`/maps/${m.slug}`} className="block">
              <div className="glass glass-hover h-full p-5">
                <div className="flex items-start justify-between">
                  <div className="text-lg font-semibold">{m.name}</div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      m.lean === "attacker"
                        ? "bg-accent/15 text-accent"
                        : m.lean === "defender"
                          ? "bg-cyan/15 text-cyan"
                          : "bg-panel text-ink-dim",
                    )}
                  >
                    {m.lean === "balanced" ? "balanced" : `${m.lean}-sided`}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-faint">
                  {m.location} · since {m.released}
                </div>
                <ul className="mt-4 space-y-1.5">
                  {m.sites.map((s) => (
                    <li key={s} className="text-xs text-ink-dim">
                      ◈ {s}
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
