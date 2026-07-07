"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@siegeiq/shared";

interface Weapon {
  slug: string;
  name: string;
  type: string;
  damage: number;
  rpm: number;
  mag: number;
  adsMs: number;
  reloadMs: number;
  users: string[];
}
interface Op {
  slug: string;
  name: string;
}

type SortKey = "name" | "damage" | "rpm" | "dps" | "mag";

export function WeaponTable({
  weapons,
  operators,
}: {
  weapons: unknown;
  operators: unknown;
}) {
  const all = weapons as Weapon[];
  const ops = operators as Op[];
  const opName = (slug: string) => ops.find((o) => o.slug === slug)?.name ?? slug;

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<SortKey>("dps");

  const types = useMemo(() => ["all", ...new Set(all.map((w) => w.type))], [all]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dps = (w: Weapon) => (w.rpm > 0 ? (w.damage * w.rpm) / 60 : w.damage);
    return all
      .filter((w) => type === "all" || w.type === type)
      .filter((w) => !needle || w.name.toLowerCase().includes(needle))
      .map((w) => ({ ...w, dps: Math.round(dps(w)) }))
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : (b[sort] as number) - (a[sort] as number),
      );
  }, [all, q, type, sort]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="glass flex flex-1 items-center gap-2 px-3 py-2">
          <Search size={16} className="text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search weapons…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="glass px-3 py-2 text-sm outline-none"
          aria-label="Weapon type"
        >
          {types.map((t) => (
            <option key={t} value={t} className="bg-bg">
              {t === "all" ? "All types" : t}
            </option>
          ))}
        </select>
      </div>

      <div className="glass overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-faint">
              <SortTh label="Weapon" k="name" sort={sort} setSort={setSort} left />
              <th className="px-4 py-2.5 text-right font-medium">Type</th>
              <SortTh label="Damage" k="damage" sort={sort} setSort={setSort} />
              <SortTh label="RPM" k="rpm" sort={sort} setSort={setSort} />
              <SortTh label="DPS" k="dps" sort={sort} setSort={setSort} />
              <SortTh label="Mag" k="mag" sort={sort} setSort={setSort} />
              <th className="px-4 py-2.5 text-right font-medium">Used by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.slug} id={w.slug} className="border-t border-line/60 hover:bg-panel">
                <td className="px-4 py-2.5 font-medium">{w.name}</td>
                <td className="px-4 py-2.5 text-right text-ink-dim">{w.type}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{w.damage}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{w.rpm || "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-accent">
                  {w.dps}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{w.mag}</td>
                <td className="max-w-[220px] px-4 py-2.5 text-right text-xs text-ink-dim">
                  {w.users.slice(0, 4).map((u, i) => (
                    <span key={u}>
                      {i > 0 ? ", " : ""}
                      <Link href={`/operators/${u}`} className="hover:text-accent">
                        {opName(u)}
                      </Link>
                    </span>
                  ))}
                  {w.users.length > 4 ? ` +${w.users.length - 4}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  setSort,
  left,
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  setSort: (k: SortKey) => void;
  left?: boolean;
}) {
  return (
    <th className={cn("px-4 py-2.5 font-medium", left ? "text-left" : "text-right")}>
      <button
        onClick={() => setSort(k)}
        className={cn("uppercase tracking-wider hover:text-ink", sort === k && "text-accent")}
      >
        {label}
        {sort === k ? " ↓" : ""}
      </button>
    </th>
  );
}
