"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Crosshair } from "lucide-react";
import { cn } from "@siegeiq/shared";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/operators", label: "Operators" },
  { href: "/weapons", label: "Weapons" },
  { href: "/maps", label: "Maps" },
  { href: "/live", label: "Live Match" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-hot text-bg">
            <Crosshair size={16} strokeWidth={2.5} />
          </span>
          Siege<span className="text-gradient">IQ</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm text-ink-dim transition hover:bg-panel hover:text-ink",
                (pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href))) &&
                  "bg-panel text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-line px-4 py-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-ink-dim hover:bg-panel hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
