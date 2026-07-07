"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import type { LiveMatchState } from "@siegeiq/shared";
import { liveCoachInsights } from "@siegeiq/coaching/insights/live-coach";
import { InsightsPanel } from "@/components/profile/insights-panel";
import { cn } from "@siegeiq/shared";

/**
 * Live match viewer. Connects to the worker's WebSocket hub
 * (ws://host:8787/subscribe) and falls back to polling /api/live/:id.
 * Renders honestly: no companion connected → say so, don't fake it.
 */
export function LiveViewer() {
  const [profileId, setProfileId] = useState("");
  const [active, setActive] = useState(false);
  const [state, setState] = useState<LiveMatchState | null>(null);
  const [transport, setTransport] = useState<"ws" | "poll" | "connecting" | "off">("off");
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setTransport("off");
    setActive(false);
    setState(null);
  }, []);

  const connect = useCallback(() => {
    const id = profileId.trim();
    if (id.length < 8) return;
    setActive(true);
    setTransport("connecting");

    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8787/subscribe?profileId=${encodeURIComponent(id)}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setTransport("ws");
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { type: string; state: LiveMatchState | null };
          if (msg.type === "state") setState(msg.state);
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        wsRef.current = null;
        // fall back to polling the app server
        if (!pollRef.current) {
          setTransport("poll");
          pollRef.current = setInterval(async () => {
            try {
              const r = await fetch(`/api/live/${id}`);
              const j = (await r.json()) as { data: LiveMatchState | null };
              setState(j.data);
            } catch {
              /* keep last state */
            }
          }, 5000);
        }
      };
    } catch {
      setTransport("poll");
    }
  }, [profileId]);

  useEffect(() => () => disconnect(), [disconnect]);

  return (
    <div className="space-y-4">
      <div className="glass flex flex-col gap-2 p-2 sm:flex-row">
        <input
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="profileId (UUID from your profile URL / pairing flow)"
          className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
        />
        {active ? (
          <button
            onClick={disconnect}
            className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm text-ink-dim hover:text-ink"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={profileId.trim().length < 8}
            className="shrink-0 rounded-lg bg-gradient-to-r from-accent to-accent-hot px-5 py-2 text-sm font-semibold text-bg disabled:opacity-40"
          >
            Watch live
          </button>
        )}
      </div>

      {!active ? null : state ? (
        <LiveBoard state={state} />
      ) : (
        <div className="glass flex flex-col items-center gap-3 px-6 py-14 text-center">
          {transport === "connecting" ? (
            <Loader2 className="animate-spin text-accent" />
          ) : (
            <WifiOff className="text-ink-faint" />
          )}
          <div className="text-sm font-medium">No live match detected</div>
          <p className="max-w-md text-xs leading-relaxed text-ink-dim">
            Waiting for the companion ({transport === "ws" ? "realtime socket" : transport === "poll" ? "polling" : "connecting"}).
            If Siege is running and this stays empty: check the companion is paired with this
            profileId and that the live hub URL points at this server.
          </p>
        </div>
      )}
    </div>
  );
}

function LiveBoard({ state }: { state: LiveMatchState }) {
  const allies = state.roster.filter((r) => r.team === "ally");
  const enemies = state.roster.filter((r) => r.team === "enemy");
  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-win opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-win" />
          </span>
          <span className="text-sm font-semibold">LIVE</span>
          <span className="text-sm text-ink-dim">
            {state.map ?? "Unknown map"} · {state.mode ?? "Unknown mode"} · Round {state.round}
            {state.side ? ` · ${state.side === "attacker" ? "Attacking" : "Defending"}` : ""}
          </span>
        </div>
        <div className="text-lg font-bold tabular-nums">
          <span className="text-win">{state.score.ally}</span>
          <span className="mx-2 text-ink-faint">:</span>
          <span className="text-loss">{state.score.enemy}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RosterCard title="Your team" players={allies} tone="win" />
        <RosterCard title="Enemy team" players={enemies} tone="loss" />
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold">
          AI Coach
          <span className="ml-2 text-xs font-normal text-ink-faint">
            evidence-gated — advises only on verified roster data
          </span>
        </div>
        <LiveCoach state={state} />
      </div>

      <p className="text-xs text-ink-faint">
        Scouting tip: search any roster name for their full profile. Personal-history tips (your
        map win rate, best operator) join the feed when you watch your own paired profile.
      </p>
    </div>
  );
}

function LiveCoach({ state }: { state: LiveMatchState }) {
  const insights = useMemo(
    () => liveCoachInsights({ live: state, myMaps: [], myOperators: [] }),
    [state],
  );
  return <InsightsPanel insights={insights} />;
}

function RosterCard({
  title,
  players,
  tone,
}: {
  title: string;
  players: LiveMatchState["roster"];
  tone: "win" | "loss";
}) {
  return (
    <div className="glass overflow-hidden">
      <div
        className={cn(
          "border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider",
          tone === "win" ? "text-win" : "text-loss",
        )}
      >
        {title}
      </div>
      {players.length ? (
        <ul className="divide-y divide-line/60">
          {players.map((p) => (
            <li key={p.username} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium">{p.username}</span>
              <span className="flex items-center gap-4 text-xs text-ink-dim">
                {p.operatorSlug ? <span className="capitalize">{p.operatorSlug}</span> : null}
                <span className="tabular-nums">
                  {p.kills}/{p.deaths}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-xs text-ink-faint">Roster not reported yet.</p>
      )}
    </div>
  );
}
