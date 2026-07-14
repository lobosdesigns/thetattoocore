import Link from "next/link";
import type { Metadata } from "next";
import { AuthLegalLinks } from "../auth-legal-links";

const accountSteps = [
  ["1", "Create account", "Confirm you are 18+ and use your email/password."],
  ["2", "Confirm email", "Check inbox and junk for the confirmation link."],
  ["3", "Set up profile", "Choose your username, account type, country, and preferences."],
] as const;

const trustItems = [
  ["18+ community", "TheTattooCore is built for adult body-art discussion and media."],
  ["No visible nudity", "Crop or cover private areas before posting at launch."],
  ["No AI art", "Real artists, studios, vendors, collectors, and enthusiasts."],
  ["No scratchers", "Unsafe or unlicensed tattooing is not welcome."],
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Create account",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo =
    params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
      ? params.return_to
      : "";
  const loginHref = returnTo
    ? `/login?return_to=${encodeURIComponent(returnTo)}`
    : "/login";

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
            <h1 className="mt-3 text-3xl font-bold">Create your account</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
              Join an independent body-art community for tattoo artists,
              studios, vendors, collectors, and enthusiasts. New accounts must
              confirm email before posting, listing, messaging, or applying for
              professional verification.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {trustItems.map(([title, body]) => (
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
              {accountSteps.map(([number, title, body]) => (
                <div
                  className="rounded-md border border-white/15 bg-[color-mix(in_srgb,var(--paper-warm)_8%,transparent)] p-3"
                  key={number}
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-sm font-bold text-[var(--ink)]">
                    {number}
                  </span>
                  <h2 className="mt-3 text-sm font-bold">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/70">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="ttc-card rounded-lg p-5">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Create account</h2>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                New members sign up here. Already have an account? Use the
                sign-in page instead.
              </p>
            </div>

            {params.message ? (
              <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,var(--brand-gold)_12%)] px-3 py-2 text-sm">
                {params.message}
              </p>
            ) : null}

            <div className="space-y-5">
              <form action="/auth/signup" className="space-y-4" method="post">
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
                    I confirm I am 18 or older. This is required to create a
                    new account on TheTattooCore.
                  </span>
                </label>

                <button className="h-11 w-full rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                  Create account
                </button>
              </form>

              <form
                action="/auth/resend-confirmation"
                className="ttc-surface rounded-md border p-3"
                method="post"
              >
                <input name="redirect_to" type="hidden" value="/signup" />
                {returnTo ? (
                  <input name="return_to" type="hidden" value={returnTo} />
                ) : null}
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
                Check inbox and junk after creating an account. After
                confirming your email, save your profile before posting,
                commenting, listing Stuff, adding Gigs, previewing Merch, or
                sending DMs.
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
                href={loginHref}
              >
                Already have an account? Sign in
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
