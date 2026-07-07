import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs leading-relaxed text-ink-faint md:flex-row md:items-start md:justify-between">
        <div className="max-w-lg">
          <div className="mb-1 text-sm font-semibold text-ink-dim">SiegeIQ</div>
          Rainbow Six Siege is a registered trademark of Ubisoft Entertainment. SiegeIQ is a fan
          project — Ubisoft has not endorsed and is not responsible for this site. Player data is
          shown for informational purposes; players may request removal at any time.
        </div>
        <div className="flex gap-8">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-ink-dim">Product</span>
            <Link className="hover:text-ink" href="/operators">Operators</Link>
            <Link className="hover:text-ink" href="/maps">Maps</Link>
            <Link className="hover:text-ink" href="/live">Live Match</Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-ink-dim">Data</span>
            <a className="hover:text-ink" href="/api/health">API health</a>
            <span>Sources documented in docs/RESEARCH.md</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
