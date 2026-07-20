import Link from "next/link";
import type { Metadata } from "next";
import { AuthLegalLinks } from "../auth-legal-links";
import { requestPasswordReset } from "./actions";
import { safeStatusMessage } from "@/lib/status-message";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Reset password",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[] }>;
}) {
  const params = await searchParams;
  const statusMessage = safeStatusMessage(params.message);

  return (
    <main className="ttc-page min-h-screen px-4 py-10">
      <section className="mx-auto w-full max-w-md">
        <Link className="mb-8 block text-sm font-semibold text-[var(--foreground)]" href="/">
          TheTattooCore
        </Link>

        <div className="ttc-card rounded-lg p-5">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Reset password</h1>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">
              Enter your email and we will send a password reset link.
            </p>
          </div>

          {statusMessage ? (
            <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,var(--brand-gold)_12%)] px-3 py-2 text-sm">
              {statusMessage}
            </p>
          ) : null}

          <form className="space-y-4">
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

            <button
              className="h-11 w-full rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
              formAction={requestPasswordReset}
            >
              Send reset link
            </button>

            <Link
              className="block text-center text-sm font-semibold text-[var(--muted-strong)]"
              href="/login"
            >
              Back to sign in
            </Link>
            <AuthLegalLinks />
          </form>
        </div>
      </section>
    </main>
  );
}
