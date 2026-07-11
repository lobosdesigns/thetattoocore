import Link from "next/link";
import type { Metadata } from "next";

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
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="ttc-page min-h-screen px-4 py-10">
      <section className="mx-auto w-full max-w-5xl">
        <Link className="mb-8 block text-sm font-semibold text-[var(--paper-soft)]" href="/">
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
            <h2 className="text-2xl font-bold">Sign in or sign up</h2>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">
              Use email and password. New accounts confirm email first, then
              land on profile setup.
            </p>
          </div>

          {params.message ? (
            <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,var(--brand-gold)_12%)] px-3 py-2 text-sm">
              {params.message}
            </p>
          ) : null}

          <div className="space-y-5">
          <form action="/auth/login" className="space-y-4" method="post">
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

          <div className="relative py-1">
            <div className="h-px bg-[var(--card-rim)]" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--paper-warm)] px-3 text-xs font-semibold uppercase text-[var(--muted-strong)]">
              New account
            </span>
          </div>

          <form action="/auth/signup" className="space-y-4" method="post">
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
                autoComplete="new-password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>

            <label className="ttc-surface flex items-start gap-3 rounded-md border p-3 text-xs leading-5 text-[var(--muted)]">
              <input
                className="mt-1 size-4"
                name="age_confirmed"
                required
                type="checkbox"
              />
              <span>
                I confirm I am 18 or older. This is required to create a new
                account on TheTattooCore.
              </span>
            </label>

            <button className="ttc-surface h-11 w-full rounded-md border px-4 text-sm font-semibold">
              Create account
            </button>
          </form>

          <form
            action="/auth/resend-confirmation"
            className="ttc-surface rounded-md border p-3"
            method="post"
          >
            <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
              No confirmation email?
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                autoComplete="email"
                name="email"
                placeholder="email@example.com"
                required
                type="email"
              />
              <button className="ttc-surface h-10 rounded-md border px-3 text-sm font-semibold">
                Resend
              </button>
            </div>
          </form>

            <div className="ttc-surface rounded-md border p-3 text-xs leading-5 text-[var(--muted)]">
              Check inbox and junk after creating an account. After confirming
              your email, save your profile before posting, commenting, listing
              Stuff, adding Gigs, previewing Merch, or sending DMs.
            </div>

            <p className="text-xs leading-5 text-[var(--muted-strong)]">
              By signing up, you confirm you are 18 or older and agree to the{" "}
              <Link className="font-semibold underline" href="/terms">
                Terms
              </Link>{" "}
              and{" "}
              <Link className="font-semibold underline" href="/privacy">
                Privacy
              </Link>
              .
            </p>

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
          </div>
        </div>
        </div>
      </section>
    </main>
  );
}
