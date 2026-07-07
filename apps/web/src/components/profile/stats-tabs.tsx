"use client";

import { useState } from "react";
import type { MapStat, OperatorStat, WeaponStat } from "@siegeiq/shared";
import { cn, pct } from "@siegeiq/shared";

type Tab = "operators" | "weapons" | "maps";

export function StatsTabs({
  operators,
  weapons,
  maps,
}: {
  operators: OperatorStat[];
  weapons: WeaponStat[];
  maps: MapStat[];
}) {
  const [tab, setTab] = useState<Tab>("operators");
  const [side, setSide] = useState<"all" | "attacker" | "defender">("all");

  const ops = operators
    .filter((o) => side === "all" || o.side === side)
    .sort((a, b) => b.roundsPlayed - a.roundsPlayed);
  const weps = [...weapons].sort((a, b) => b.kills - a.kills);
  const mps = [...maps].sort((a, b) => b.roundsPlayed - a.roundsPlayed);

  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex gap-1 rounded-lg bg-bg-soft p-1">
          {(["operators", "weapons", "maps"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize text-ink-dim transition",
                tab === t && "bg-accent/15 text-accent",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "operators" ? (
          <div className="flex gap-1 rounded-lg bg-bg-soft p-1">
            {(["all", "attacker", "defender"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize text-ink-dim",
                  side === s && "bg-panel text-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        {tab === "operators" ? (
          <table className="w-full text-sm">
            <thead>
              <Tr head>
                <Th left>Operator</Th>
                <Th>Rounds</Th>
                <Th>Win %</Th>
                <Th>K/D</Th>
                <Th>HS %</Th>
                <Th>Time</Th>
              </Tr>
            </thead>
            <tbody>
              {ops.slice(0, 20).map((o) => {
                const wr = o.roundsWon / Math.max(1, o.roundsWon + o.roundsLost);
                const kd = o.kills / Math.max(1, o.deaths);
                return (
                  <Tr key={`${o.operatorSlug}-${o.side}`}>
                    <Td left>
                      <span className="font-medium">{o.operatorName}</span>
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-faint">
                        {o.side === "attacker" ? "ATK" : "DEF"}
                      </span>
                    </Td>
                    <Td>{o.roundsPlayed}</Td>
                    <Td className={wr >= 0.5 ? "text-win" : "text-loss"}>{pct(wr, 0)}</Td>
                    <Td>{kd.toFixed(2)}</Td>
                    <Td>{pct(o.headshotPct, 0)}</Td>
                    <Td>{Math.round(o.timePlayedSeconds / 3600)}h</Td>
                  </Tr>
                );
              })}
            </tbody>
          </table>
        ) : tab === "weapons" ? (
          <table className="w-full text-sm">
            <thead>
              <Tr head>
                <Th left>Weapon</Th>
                <Th>Kills</Th>
                <Th>Headshots</Th>
                <Th>HS %</Th>
              </Tr>
            </thead>
            <tbody>
              {weps.slice(0, 15).map((w) => (
                <Tr key={w.weaponSlug}>
                  <Td left className="font-medium">{w.weaponName}</Td>
                  <Td>{w.kills.toLocaleString()}</Td>
                  <Td>{w.headshots.toLocaleString()}</Td>
                  <Td>{pct(w.headshotPct, 0)}</Td>
                </Tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <Tr head>
                <Th left>Map</Th>
                <Th>Rounds</Th>
                <Th>Round win %</Th>
                <Th>Matches W–L</Th>
                <Th>K/D</Th>
              </Tr>
            </thead>
            <tbody>
              {mps.map((m) => {
                const wr = m.roundsWon / Math.max(1, m.roundsWon + m.roundsLost);
                return (
                  <Tr key={m.mapSlug}>
                    <Td left className="font-medium">{m.mapName}</Td>
                    <Td>{m.roundsPlayed}</Td>
                    <Td className={wr >= 0.5 ? "text-win" : "text-loss"}>{pct(wr, 0)}</Td>
                    <Td>
                      {m.matchesWon}–{m.matchesLost}
                    </Td>
                    <Td>{(m.kills / Math.max(1, m.deaths)).toFixed(2)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Tr({ children, head }: { children: React.ReactNode; head?: boolean }) {
  return (
    <tr
      className={cn(
        head
          ? "text-[11px] uppercase tracking-wider text-ink-faint"
          : "border-t border-line/60 transition hover:bg-panel",
      )}
    >
      {children}
    </tr>
  );
}
function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn("px-4 py-2.5 font-medium", left ? "text-left" : "text-right")}>{children}</th>;
}
function Td({
  children,
  left,
  className,
}: {
  children: React.ReactNode;
  left?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-2.5 tabular-nums", left ? "text-left" : "text-right", className)}>
      {children}
    </td>
  );
}
