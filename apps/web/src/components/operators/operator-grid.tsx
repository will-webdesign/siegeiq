"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import operatorsData from "@siegeiq/game-data/operators.json";
import { cn } from "@siegeiq/shared";
import { StaggerItem, Stagger } from "@/components/motion";

interface Op {
  slug: string;
  name: string;
  side: "attacker" | "defender";
  speed: number;
  health: number;
  org: string;
  ability: string;
  tags: string[];
  difficulty: number;
}

export function OperatorGrid() {
  const ops = operatorsData as unknown as Op[];
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | "attacker" | "defender">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ops
      .filter((o) => side === "all" || o.side === side)
      .filter(
        (o) =>
          !needle ||
          o.name.toLowerCase().includes(needle) ||
          o.ability.toLowerCase().includes(needle) ||
          o.tags.some((t) => t.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ops, q, side]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="glass flex flex-1 items-center gap-2 px-3 py-2">
          <Search size={16} className="text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, ability or role tag (e.g. hardBreach)…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-bg-soft p-1">
          {(["all", "attacker", "defender"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize text-ink-dim",
                side === s && "bg-accent/15 text-accent",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" staggerMs={20}>
        {filtered.map((o) => (
          <StaggerItem key={o.slug}>
            <Link href={`/operators/${o.slug}`} className="block">
              <div className="glass glass-hover h-full p-4">
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold",
                      o.side === "attacker"
                        ? "bg-accent/15 text-accent"
                        : "bg-cyan/15 text-cyan",
                    )}
                  >
                    {o.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                    {o.side === "attacker" ? "ATK" : "DEF"}
                  </span>
                </div>
                <div className="mt-3 font-semibold">{o.name}</div>
                <div className="mt-0.5 line-clamp-1 text-xs text-ink-dim">{o.ability}</div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-faint">
                  <span title="Speed">⚡ {o.speed}</span>
                  <span title="Health">❤ {o.health}</span>
                  <span title="Difficulty">{"●".repeat(o.difficulty)}{"○".repeat(3 - o.difficulty)}</span>
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      {!filtered.length ? (
        <p className="py-16 text-center text-sm text-ink-dim">No operators match that filter.</p>
      ) : null}
    </div>
  );
}
