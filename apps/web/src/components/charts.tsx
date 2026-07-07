"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { rankFromRp } from "@siegeiq/shared";

const AXIS = { stroke: "#626977", fontSize: 11 } as const;
const TOOLTIP_STYLE = {
  background: "#12151f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 12,
  color: "#e7e9ee",
} as const;

export function RankHistoryChart({ data }: { data: { t: number; rp: number }[] }) {
  if (!data.length) return null;
  const fmt = (t: number) =>
    new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="rpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="t" tickFormatter={fmt} tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis
          dataKey="rp"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          domain={["dataMin - 100", "dataMax + 100"]}
          width={58}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
          formatter={(v) => [`${Number(v).toLocaleString()} RP — ${rankFromRp(Number(v)).name}`, ""]}
        />
        <Area
          type="monotone"
          dataKey="rp"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#rpFill)"
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WinRateBars({
  data,
}: {
  data: { name: string; winRate: number; rounds: number }[];
}) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#9aa1af" }} width={96} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, _n, item) => [
            `${Number(v).toFixed(1)}% over ${item?.payload?.rounds ?? "?"} rounds`,
            "Win rate",
          ]}
        />
        <Bar dataKey="winRate" radius={[0, 6, 6, 0]} animationDuration={600}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.winRate >= 50 ? "#34d399" : "#f87171"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PerformanceBreakdown({ parts }: { parts: Record<string, number> }) {
  const data = Object.entries(parts).map(([name, value]) => ({ name, value }));
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={data.length * 42}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
        <XAxis type="number" domain={[0, 35]} hide />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "#9aa1af" }} width={90} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} pts`, ""]} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#22d3ee" fillOpacity={0.8} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}
