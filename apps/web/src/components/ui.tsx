import type { ReactNode } from "react";
import { cn } from "@siegeiq/shared";
import { rankFromRp } from "@siegeiq/shared";

export function GlassCard({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cn("glass p-5", hover && "glass-hover", className)}>{children}</div>;
}

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "win" | "loss" | "accent";
}) {
  return (
    <div className="glass px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "win" && "text-win",
          tone === "loss" && "text-loss",
          tone === "accent" && "text-gradient",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-ink-dim">{sub}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-ink-dim">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function RankBadge({ rp, size = "md" }: { rp: number; size?: "sm" | "md" | "lg" }) {
  const rank = rankFromRp(rp);
  const dims = size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs";
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn("flex items-center justify-center rounded-xl font-bold", dims)}
        style={{
          color: rank.color,
          background: `${rank.color}1a`,
          border: `1px solid ${rank.color}40`,
        }}
        aria-label={rank.name}
      >
        {rank.short}
      </div>
      {size !== "sm" ? (
        <div>
          <div className={cn("font-semibold", size === "lg" ? "text-xl" : "text-sm")}>
            {rank.name}
          </div>
          <div className="text-xs tabular-nums text-ink-dim">{rp.toLocaleString()} RP</div>
        </div>
      ) : null}
    </div>
  );
}

export function SourceBadge({
  source,
  stale,
  fetchedAt,
}: {
  source: string;
  stale?: boolean;
  fetchedAt?: string;
}) {
  const label =
    source === "demo"
      ? "Demo data"
      : source === "ubisoft"
        ? "Ubisoft"
        : source === "r6data"
          ? "R6Data"
          : source;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        source === "demo"
          ? "border-violet/40 bg-violet/10 text-violet"
          : stale
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-win/30 bg-win/10 text-win",
      )}
      title={fetchedAt ? `Fetched ${fetchedAt}` : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
      {stale ? " · cached" : ""}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-base font-semibold">{title}</div>
      <p className="max-w-md text-sm leading-relaxed text-ink-dim">{body}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}
