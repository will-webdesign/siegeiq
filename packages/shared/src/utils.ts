import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function ratio(a: number, b: number): number {
  return b === 0 ? a : a / b;
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  if (h >= 1) return `${fmt(h)}h`;
  return `${Math.floor(seconds / 60)}m`;
}

export function timeAgo(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Deterministic 32-bit hash (FNV-1a) for demo seeding. */
export function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    // letters that don't decompose under NFD (Nøkk, Capitão handled by NFD)
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
