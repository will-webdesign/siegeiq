import Link from "next/link";
import { Radar, Swords, LineChart, ShieldHalf } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { GlassCard, SectionHeader } from "@/components/ui";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { SITE } from "@siegeiq/shared";
import { ServiceStatusStrip } from "@/components/home/status-strip";
import { MetaHighlights } from "@/components/home/meta-highlights";

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="pt-10 text-center md:pt-20">
        <FadeIn>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Siege stats that actually
            <span className="text-gradient"> coach you</span>.
          </h1>
        </FadeIn>
        <FadeIn delay={0.08}>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-dim md:text-lg">
            {SITE.tagline} Rank history, operator analytics and live match intelligence —
            just a username and platform. No logins, no tokens, ever.
          </p>
        </FadeIn>
        <FadeIn delay={0.16} className="mx-auto mt-8 max-w-2xl">
          <SearchBar large />
        </FadeIn>
        <FadeIn delay={0.24}>
          <p className="mt-3 text-xs text-ink-faint">
            Try any name — e.g. <TryLink name="Beaulo" /> · <TryLink name="Spoit" /> ·{" "}
            <TryLink name="Shaiiko.BDS" />
          </p>
        </FadeIn>
      </section>

      {/* Live service status */}
      <ServiceStatusStrip />

      {/* Feature grid */}
      <section>
        <SectionHeader
          title="Built like a pro tool"
          sub="Every number is sourced, cached and labeled — nothing invented."
        />
        <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <GlassCard hover className="h-full">
                <f.icon className="mb-3 text-accent" size={22} />
                <div className="font-semibold">{f.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">{f.body}</p>
              </GlassCard>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Meta highlights from the database pages */}
      <MetaHighlights />

      {/* Live match CTA */}
      <section>
        <GlassCard className="flex flex-col items-start gap-6 bg-gradient-to-br from-panel to-accent/5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Live match scouting</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-dim">
              Browsers can’t see your match — that’s a hard technical limit, not a paywall. Our
              optional desktop companion streams live rosters here so SiegeIQ can scout every
              player and coach your round. The website works fully without it.
            </p>
          </div>
          <Link
            href="/live"
            className="shrink-0 rounded-xl bg-gradient-to-r from-accent to-accent-hot px-5 py-2.5 text-sm font-semibold text-bg"
          >
            How it works
          </Link>
        </GlassCard>
      </section>
    </div>
  );
}

function TryLink({ name }: { name: string }) {
  return (
    <Link href={`/profile/uplay/${encodeURIComponent(name)}`} className="text-accent hover:underline">
      {name}
    </Link>
  );
}

const FEATURES = [
  {
    icon: LineChart,
    title: "Rank history that survives seasons",
    body: "Ubisoft deletes past-season data. SiegeIQ snapshots every profile it sees, so your graph starts the day you're first looked up — and never disappears.",
  },
  {
    icon: Swords,
    title: "Operator & weapon analytics",
    body: "Per-side win rates, entry duels, headshot discipline and time played — with minimum sample sizes before we call anything a trend.",
  },
  {
    icon: Radar,
    title: "Live match intel",
    body: "With the optional companion: full lobby scouting, team win probability with confidence bands, and comp warnings before the drone phase ends.",
  },
  {
    icon: ShieldHalf,
    title: "Evidence-gated coach",
    body: "Every tip cites the numbers that produced it. No data, no advice — the coach literally cannot hallucinate.",
  },
];
