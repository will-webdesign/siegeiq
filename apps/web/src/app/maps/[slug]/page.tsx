import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import mapsData from "@siegeiq/game-data/maps.json";
import operatorsData from "@siegeiq/game-data/operators.json";
import { GlassCard, SectionHeader } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { cn } from "@siegeiq/shared";

interface MapRow {
  slug: string;
  name: string;
  location: string;
  released: string;
  ranked: boolean;
  sites: string[];
  lean: string;
  bestAttackers: string[];
  bestDefenders: string[];
  notes: string;
}
interface Op {
  slug: string;
  name: string;
  side: string;
}

const MAPS = mapsData as unknown as MapRow[];
const OPS = operatorsData as unknown as Op[];

export function generateStaticParams() {
  return MAPS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const map = MAPS.find((m) => m.slug === slug);
  return { title: map ? `${map.name} — sites, lean & picks` : "Map" };
}

export default async function MapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const map = MAPS.find((m) => m.slug === slug);
  if (!map) notFound();

  const opChip = (opSlug: string) => {
    const op = OPS.find((o) => o.slug === opSlug);
    if (!op) return null;
    return (
      <Link
        key={op.slug}
        href={`/operators/${op.slug}`}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition hover:scale-105",
          op.side === "attacker"
            ? "border-accent/30 bg-accent/10 text-accent"
            : "border-cyan/30 bg-cyan/10 text-cyan",
        )}
      >
        {op.name}
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{map.name}</h1>
              <div className="mt-1 text-sm text-ink-dim">
                {map.location} · in rotation since {map.released}
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
                map.lean === "attacker"
                  ? "bg-accent/15 text-accent"
                  : map.lean === "defender"
                    ? "bg-cyan/15 text-cyan"
                    : "bg-panel text-ink-dim",
              )}
            >
              {map.lean === "balanced" ? "balanced" : `${map.lean}-sided`}
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-dim">{map.notes}</p>
        </GlassCard>
      </FadeIn>

      <section>
        <SectionHeader title="Bomb sites" sub="Ranked rotation order varies by season." />
        <div className="grid gap-3 sm:grid-cols-2">
          {map.sites.map((s, i) => (
            <GlassCard key={s} className="flex items-center gap-3 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel text-sm font-bold text-accent">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-sm">{s}</span>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <SectionHeader title="Strong attackers here" />
          <div className="flex flex-wrap gap-2">{map.bestAttackers.map(opChip)}</div>
        </GlassCard>
        <GlassCard>
          <SectionHeader title="Strong defenders here" />
          <div className="flex flex-wrap gap-2">{map.bestDefenders.map(opChip)}</div>
        </GlassCard>
      </section>
    </div>
  );
}
