"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { PLATFORM_LABELS, type Platform } from "@siegeiq/shared";
import { cn } from "@siegeiq/shared";

export function SearchBar({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("uplay");
  const [busy, setBusy] = useState(false);

  const go = (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = name.trim();
    if (n.length < 2) return;
    setBusy(true);
    router.push(`/profile/${platform}/${encodeURIComponent(n)}`);
  };

  return (
    <form onSubmit={go} className={cn("glass flex items-center gap-2 p-2", large && "p-2.5")}>
      <div className="flex shrink-0 gap-1 rounded-lg bg-bg-soft p-1">
        {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-dim transition",
              platform === p && "bg-accent/15 text-accent",
            )}
            aria-pressed={platform === p}
          >
            {p === "uplay" ? "PC" : p === "psn" ? "PSN" : "Xbox"}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Search a Ubisoft username…"
        aria-label="Player username"
        className={cn(
          "w-full bg-transparent px-2 text-sm outline-none placeholder:text-ink-faint",
          large && "text-base",
        )}
        maxLength={30}
      />
      <button
        type="submit"
        disabled={name.trim().length < 2 || busy}
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-accent-hot px-4 py-2 text-sm font-semibold text-bg transition disabled:opacity-40",
          large && "px-5 py-2.5",
        )}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        <span className="hidden sm:inline">Search</span>
      </button>
    </form>
  );
}
