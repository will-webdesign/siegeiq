"use client";

import { useState } from "react";
import { GlassCard, SectionHeader } from "@/components/ui";
import { cn } from "@siegeiq/shared";

interface Overview {
  demoMode: boolean;
  providers: Array<{
    id: string;
    label: string;
    configured: boolean;
    active: boolean;
    circuit: { state: string; consecutiveFailures: number };
  }>;
  cache: { backend: string; keys?: number };
  database: {
    enabled: boolean;
    players: number | null;
    snapshots: number | null;
    inferredMatches: number | null;
  };
  time: string;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(r.status === 401 ? "Invalid admin token" : `HTTP ${r.status}`);
      setData((await r.json()) as Overview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
      setData(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHeader title="Admin" sub="Provider health, cache and persistence at a glance." />

      <div className="glass flex gap-2 p-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
        />
        <button
          onClick={load}
          className="shrink-0 rounded-lg bg-gradient-to-r from-accent to-accent-hot px-5 py-2 text-sm font-semibold text-bg"
        >
          Load
        </button>
      </div>
      {err ? <p className="text-sm text-loss">{err}</p> : null}

      {data ? (
        <div className="space-y-4">
          <GlassCard>
            <div className="mb-3 text-sm font-semibold">Providers</div>
            <ul className="space-y-2">
              {data.providers.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>
                    {p.label}
                    {p.active ? (
                      <span className="ml-2 rounded-full bg-win/10 px-2 py-0.5 text-[10px] text-win">
                        active
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      !p.configured
                        ? "text-ink-faint"
                        : p.circuit.state === "closed"
                          ? "text-win"
                          : "text-loss",
                    )}
                  >
                    {!p.configured
                      ? "not configured"
                      : `circuit ${p.circuit.state} (${p.circuit.consecutiveFailures} fails)`}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <div className="grid gap-4 sm:grid-cols-3">
            <GlassCard>
              <div className="text-xs uppercase tracking-wider text-ink-faint">Cache</div>
              <div className="mt-1 text-lg font-semibold">{data.cache.backend}</div>
              <div className="text-xs text-ink-dim">{data.cache.keys ?? "?"} keys</div>
            </GlassCard>
            <GlassCard>
              <div className="text-xs uppercase tracking-wider text-ink-faint">Players tracked</div>
              <div className="mt-1 text-lg font-semibold">{data.database.players ?? "—"}</div>
              <div className="text-xs text-ink-dim">
                {data.database.enabled ? "postgres connected" : "db not configured"}
              </div>
            </GlassCard>
            <GlassCard>
              <div className="text-xs uppercase tracking-wider text-ink-faint">Snapshots</div>
              <div className="mt-1 text-lg font-semibold">{data.database.snapshots ?? "—"}</div>
              <div className="text-xs text-ink-dim">
                {data.database.inferredMatches ?? "—"} inferred matches
              </div>
            </GlassCard>
          </div>

          <p className="text-xs text-ink-faint">
            demoMode={String(data.demoMode)} · {data.time}
          </p>
        </div>
      ) : null}
    </div>
  );
}
