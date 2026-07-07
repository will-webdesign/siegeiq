import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import operatorsData from "@siegeiq/game-data/operators.json";
import weaponsData from "@siegeiq/game-data/weapons.json";
import { GlassCard, SectionHeader, StatTile } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { cn } from "@siegeiq/shared";

interface Op {
  slug: string;
  name: string;
  side: "attacker" | "defender";
  speed: number;
  health: number;
  org: string;
  ability: string;
  primaries: string[];
  secondaries: string[];
  gadgets: string[];
  difficulty: number;
  tags: string[];
  counters: string[];
  counteredBy: string[];
  seedNote?: string;
}

interface Weapon {
  slug: string;
  name: string;
  type: string;
  damage: number;
  rpm: number;
  mag: number;
}

const OPS = operatorsData as unknown as Op[];
const WEAPONS = weaponsData as unknown as Weapon[];

export function generateStaticParams() {
  return OPS.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const op = OPS.find((o) => o.slug === slug);
  return {
    title: op ? `${op.name} — loadout, ability & counters` : "Operator",
    description: op ? `${op.name} (${op.side}): ${op.ability}. Loadout, counters and role.` : "",
  };
}

export default async function OperatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const op = OPS.find((o) => o.slug === slug);
  if (!op) notFound();

  const primaryWeapons = op.primaries
    .map((name) => WEAPONS.find((w) => w.name === name))
    .filter((w): w is Weapon => Boolean(w));
  const counterOps = op.counters
    .map((s) => OPS.find((o) => o.slug === s))
    .filter((o): o is Op => Boolean(o));
  const counteredByOps = op.counteredBy
    .map((s) => OPS.find((o) => o.slug === s))
    .filter((o): o is Op => Boolean(o));

  return (
    <div className="space-y-8">
      <FadeIn>
        <GlassCard className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold",
                op.side === "attacker" ? "bg-accent/15 text-accent" : "bg-cyan/15 text-cyan",
              )}
            >
              {op.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{op.name}</h1>
              <div className="mt-1 text-sm text-ink-dim">
                {op.org} · {op.side === "attacker" ? "Attacker" : "Defender"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {op.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-ink-dim"
              >
                {t}
              </span>
            ))}
          </div>
        </GlassCard>
      </FadeIn>

      {op.seedNote ? (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs text-accent">
          Data note: {op.seedNote}.
        </p>
      ) : null}

      <section className="grid grid-cols-3 gap-3">
        <StatTile label="Speed" value={"⚡".repeat(op.speed)} sub={`${op.speed} / 3`} />
        <StatTile label="Health" value={String(op.health)} sub="HP" />
        <StatTile
          label="Difficulty"
          value={"●".repeat(op.difficulty) + "○".repeat(3 - op.difficulty)}
          sub={op.difficulty === 1 ? "Beginner friendly" : op.difficulty === 2 ? "Intermediate" : "Advanced"}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <SectionHeader title="Ability" />
          <p className="text-sm leading-relaxed text-ink-dim">{op.ability}</p>
        </GlassCard>
        <GlassCard>
          <SectionHeader title="Loadout" />
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-faint">Primaries</dt>
              <dd className="mt-1">{op.primaries.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-faint">Secondaries</dt>
              <dd className="mt-1">{op.secondaries.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-faint">Gadgets</dt>
              <dd className="mt-1">{op.gadgets.join(" · ")}</dd>
            </div>
          </dl>
        </GlassCard>
      </section>

      {primaryWeapons.length ? (
        <section>
          <SectionHeader title="Primary weapon stats" />
          <div className="glass overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-2.5 text-left font-medium">Weapon</th>
                  <th className="px-4 py-2.5 text-right font-medium">Type</th>
                  <th className="px-4 py-2.5 text-right font-medium">Damage</th>
                  <th className="px-4 py-2.5 text-right font-medium">RPM</th>
                  <th className="px-4 py-2.5 text-right font-medium">Mag</th>
                </tr>
              </thead>
              <tbody>
                {primaryWeapons.map((w) => (
                  <tr key={w.slug} className="border-t border-line/60">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/weapons#${w.slug}`} className="hover:text-accent">
                        {w.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-dim">{w.type}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{w.damage}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{w.rpm || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{w.mag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <SectionHeader title="Strong against" />
          <OpChips ops={counterOps} empty="No hard counters listed." />
        </GlassCard>
        <GlassCard>
          <SectionHeader title="Countered by" />
          <OpChips ops={counteredByOps} empty="No listed counters — positioning decides." />
        </GlassCard>
      </section>
    </div>
  );
}

function OpChips({ ops, empty }: { ops: Op[]; empty: string }) {
  if (!ops.length) return <p className="text-sm text-ink-dim">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {ops.map((o) => (
        <Link
          key={o.slug}
          href={`/operators/${o.slug}`}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition hover:scale-105",
            o.side === "attacker"
              ? "border-accent/30 bg-accent/10 text-accent"
              : "border-cyan/30 bg-cyan/10 text-cyan",
          )}
        >
          {o.name}
        </Link>
      ))}
    </div>
  );
}
