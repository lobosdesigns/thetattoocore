import Link from "next/link";
import type { Metadata } from "next";
import { login, signup } from "./actions";

const setupSteps = [
  ["1", "Confirm email", "New accounts get an email link before login."],
  ["2", "Save profile", "Choose your username, account type, country, and 18+ confirmation."],
  ["3", "Post with +", "Use the bottom-right plus button in 4U, Gossip, Stuff, or Gigs."],
] as const;

const stanceItems = [
  ["No AI feed", "No AI art, AI search, or AI creator replacement."],
  ["No scratchers", "Unsafe or unlicensed tattooing is not welcome."],
  ["Pro Stuff", "Buy, sell, trade, and vendor contact require verification."],
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
    <main className="min-h-screen bg-[#202020] px-4 py-10 text-[#171412]">
      <section className="mx-auto w-full max-w-5xl">
        <Link className="mb-8 block text-sm font-semibold text-[#f2f1ee]" href="/">
          TheTattooCore
        </Link>

        <div className="grid gap-4 lg:grid-cols-[1fr_26rem]">
          <section className="rounded-lg border border-[#3a332d] bg-[#171412] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              The heart of the tattoo community
            </p>
            <h1 className="mt-3 text-3xl font-bold">Join The Tattoo Core</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
              Find artists, share work, start Gossip, list Stuff, post Gigs,
              and DM other members. The community is 18+ because tattoo,
              piercing, and body-art documentation can include adult placement
              context without being pornographic.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {stanceItems.map(([title, body]) => (
                <div
                  className="rounded-md border border-[#c8953b]/35 bg-[#c8953b]/10 p-3"
                  key={title}
                >
                  <p className="text-sm font-bold text-[#f3c15f]">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/70">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {setupSteps.map(([number, title, body]) => (
                <div
                  className="rounded-md border border-white/15 bg-white/5 p-3"
                  key={number}
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-md bg-white text-sm font-bold text-[#171412]">
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

        <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-5">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Sign in or sign up</h2>
            <p className="mt-1 text-sm text-[#766d62]">
              Use email and password. New accounts confirm email first, then
              land on profile setup.
            </p>
          </div>

          {params.message ? (
            <p className="mb-4 rounded-md border border-[#cfc8bd] bg-[#e8e4dc] px-3 py-2 text-sm">
              {params.message}
            </p>
          ) : null}

          <form className="space-y-4">
            <input
              name="origin"
              type="hidden"
              value={process.env.NEXT_PUBLIC_SITE_URL ?? "https://thetattoocore.com"}
            />

            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="email"
                required
                type="email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                className="h-11 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                formAction={login}
              >
                Sign in
              </button>
              <button
                className="h-11 rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
                formAction={signup}
              >
                Create account
              </button>
            </div>

            <div className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3 text-xs leading-5 text-[#4f473f]">
              Check inbox and junk after creating an account. After confirming
              your email, save your profile before posting, commenting, listing
              Stuff, adding Gigs, or sending DMs.
            </div>

            <p className="text-xs leading-5 text-[#766d62]">
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
              className="block text-center text-sm font-semibold text-[#766d62]"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </form>
        </div>
        </div>
      </section>
    </main>
  );
}
