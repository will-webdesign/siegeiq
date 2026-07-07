import type { Metadata } from "next";
import { MonitorDown, Radio, ShieldQuestion } from "lucide-react";
import { GlassCard, SectionHeader } from "@/components/ui";
import { LiveViewer } from "@/components/live/live-viewer";

export const metadata: Metadata = {
  title: "Live match",
  description:
    "Live Rainbow Six Siege match scouting via the optional SiegeIQ desktop companion.",
};

export default function LivePage() {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Live match</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
          Straight answer: a website cannot detect your match. No Ubisoft endpoint exposes
          “current game”, and browsers can’t read game state — R6 Tracker’s live features run on
          Overwolf, a desktop runtime, for exactly this reason. SiegeIQ does it the same honest
          way: a lightweight optional companion streams your lobby here in real time. Without it,
          everything else on this site still works.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <GlassCard>
          <MonitorDown className="mb-3 text-accent" size={20} />
          <div className="text-sm font-semibold">1 · Install the companion</div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
            Overwolf-based, PC only, open source in <code>companion/</code>. Reads sanctioned game
            events — never memory, never injections. BattlEye-safe by design.
          </p>
        </GlassCard>
        <GlassCard>
          <ShieldQuestion className="mb-3 text-accent" size={20} />
          <div className="text-sm font-semibold">2 · Pair it to your profile</div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
            Search your profile, copy the pairing token below into the companion. The token only
            authorizes streaming your own live events — revocable anytime.
          </p>
        </GlassCard>
        <GlassCard>
          <Radio className="mb-3 text-accent" size={20} />
          <div className="text-sm font-semibold">3 · Queue up</div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
            Roster, side, round and score appear here live; every player gets scouted through the
            same stats pipeline as profile pages, and the coach reads the lobby.
          </p>
        </GlassCard>
      </section>

      <section>
        <SectionHeader
          title="Live viewer"
          sub="Enter the profileId shown on your profile page (or pair via the button there)."
        />
        <LiveViewer />
      </section>
    </div>
  );
}
