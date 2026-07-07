import type { Metadata, Viewport } from "next";
import { SITE } from "@siegeiq/shared";
import { isDemoMode } from "@siegeiq/server/env";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — Rainbow Six Siege stats, rank history & live match intel`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoMode();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {demo ? (
          <div className="border-b border-violet/30 bg-violet/10 px-4 py-1.5 text-center text-xs text-violet">
            Demo mode — deterministic sample data. Add a Ubisoft service account or R6Data key in
            <code className="mx-1 rounded bg-bg-soft px-1.5 py-0.5">.env</code> for real stats.
          </div>
        ) : null}
        <Nav />
        <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 pt-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
