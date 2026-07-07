import { TTL, cached } from "@siegeiq/server/cache";
import { withFailover } from "@siegeiq/server/providers/registry";
import type { PlatformStatus } from "@siegeiq/shared";
import { cn } from "@siegeiq/shared";

async function getStatus(): Promise<PlatformStatus[] | null> {
  try {
    const hit = await cached("service-status", TTL.serviceStatus, async () => {
      const res = await withFailover("getStatus", (p) => p.getStatus());
      return res.data;
    });
    return hit.value;
  } catch {
    return null;
  }
}

export async function ServiceStatusStrip() {
  const status = await getStatus();
  if (!status?.length) return null;

  // Collapse to one entry per platform family
  const seen = new Map<string, PlatformStatus>();
  for (const s of status) {
    const key = s.platform.toLowerCase().includes("ps")
      ? "PlayStation"
      : s.platform.toLowerCase().includes("xbox")
        ? "Xbox"
        : "PC";
    const existing = seen.get(key);
    if (!existing || s.status !== "online") seen.set(key, { ...s, platform: key });
  }

  return (
    <section className="glass flex flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-3">
      <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">
        Siege servers
      </span>
      {[...seen.values()].map((s) => (
        <div key={s.platform} className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              s.status === "online"
                ? "bg-win"
                : s.status === "maintenance"
                  ? "bg-accent"
                  : "bg-loss",
            )}
          />
          <span className="text-ink-dim">{s.platform}</span>
          <span className="capitalize">{s.status}</span>
        </div>
      ))}
    </section>
  );
}
