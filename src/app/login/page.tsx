import Link from "next/link";
import type { Metadata } from "next";
import { AuthLegalLinks } from "../auth-legal-links";

const setupSteps = [
  ["1", "Confirm email", "New accounts get an email link before login."],
  ["2", "Save profile", "Choose your username, account type, country, and 18+ confirmation."],
  ["3", "Post with +", "Use the bottom-right plus button in 4U, Gossip, Stuff, Gigs, or planned Merch."],
] as const;

const stanceItems = [
  ["No AI feed", "No AI art, AI search, or AI creator replacement."],
  ["No scratchers", "Unsafe or unlicensed tattooing is not welcome."],
  ["Pro Stuff", "Buy, sell, trade, and vendor contact require verification."],
  ["Independent core", "Built for body-art people, not corporate takeover."],
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo =
    params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
      ? params.return_to
      : "";

  return (
    <main className="ttc-page min-h-screen px-4 py-10">
      <section className="mx-auto w-full max-w-5xl">
        <Link className="mb-8 block text-sm font-semibold text-[var(--foreground)]" href="/">
          TheTattooCore
        </Link>

        <div className="grid gap-4 lg:grid-cols-[1fr_26rem]">
          <section className="rounded-lg border border-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--ink)_92%,black)] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              The heart of the tattoo community
            </p>
            <h1 className="mt-3 text-3xl font-bold">Join The Tattoo Core</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
              Find artists, share work, start Gossip, list Stuff, post Gigs,
              and DM other members. The community is 18+ because tattoo,
              piercing, and body-art documentation can include sensitive
              placement, healing, or modification context. Visible nudity is
              not allowed for launch.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {stanceItems.map(([title, body]) => (
                <div
                  className="rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--brand-gold)_12%,transparent)] p-3"
                  key={title}
                >
                  <p className="text-sm font-bold text-[var(--brand-gold)]">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/70">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {setupSteps.map(([number, title, body]) => (
                <div
                  className="rounded-md border border-white/15 bg-[color-mix(in_srgb,var(--paper-warm)_8%,transparent)] p-3"
                  key={number}
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-sm font-bold text-[var(--ink)]">
                    {number}
                  </span>
                  <h2 className="mt-3 text-sm font-bold">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/70">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="ttc-card rounded-lg p-5">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Sign in</h2>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                Existing members can sign in with email and password.
              </p>
            </div>

            {params.message ? (
              <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,var(--brand-gold)_12%)] px-3 py-2 text-sm">
                {params.message}
              </p>
            ) : null}

            <div className="space-y-5">
              <form action="/auth/login" className="space-y-4" method="post">
                {returnTo ? (
                  <input name="return_to" type="hidden" value={returnTo} />
                ) : null}
                <label className="block">
                  <span className="text-sm font-medium">Email</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    autoComplete="email"
                    name="email"
                    required
                    type="email"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">Password</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    autoComplete="current-password"
                    minLength={8}
                    name="password"
                    required
                    type="password"
                  />
                </label>

                <button className="h-11 w-full rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                  Sign in
                </button>
              </form>

              <div className="ttc-surface rounded-md border p-4 text-center">
                <p className="text-sm font-bold">New to TheTattooCore?</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Create a separate account with 18+ confirmation and email
                  verification.
                </p>
                <Link
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--brand-gold)_18%,var(--paper-warm))] px-4 text-sm font-semibold text-[var(--foreground)]"
                  href="/signup"
                >
                  Create new account
                </Link>
              </div>

              <Link
                className="block text-center text-sm font-semibold text-[var(--muted-strong)]"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
              <Link
                className="block text-center text-sm font-semibold text-[var(--muted-strong)]"
                href="/support"
              >
                Support and account help
              </Link>
              <AuthLegalLinks />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
