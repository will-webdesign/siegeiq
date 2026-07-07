import Link from "next/link";
import { SearchBar } from "@/components/search-bar";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <div className="text-gradient text-6xl font-bold">404</div>
      <h1 className="mt-3 text-xl font-semibold">Nothing at this location</h1>
      <p className="mt-2 text-sm text-ink-dim">
        Player not found on that platform, or the page doesn’t exist. Names are exact on Ubisoft’s
        side — check spelling and platform.
      </p>
      <div className="mt-8">
        <SearchBar />
      </div>
      <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
        ← Back home
      </Link>
    </div>
  );
}
