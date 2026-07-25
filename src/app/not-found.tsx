import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: {
    follow: false,
    googleBot: {
      follow: false,
      index: false,
    },
    index: false,
  },
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="ttc-page flex min-h-screen items-center justify-center px-4 py-12">
      <section className="ttc-card ttc-page-panel max-w-md rounded-lg border border-[var(--card-rim)] p-6 text-center">
        <p className="text-sm font-bold uppercase text-[var(--muted-strong)]">
          404
        </p>
        <h1 className="mt-2 text-2xl font-black">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          The page you are looking for is not available.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] px-4 text-sm font-semibold"
          href="/"
        >
          Back home
        </Link>
      </section>
    </main>
  );
}
