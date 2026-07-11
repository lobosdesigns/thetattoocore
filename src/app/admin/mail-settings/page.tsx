import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, Send, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminSectionNav } from "../admin-section-nav";
import { MailTestForm } from "../mail-test-form";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  email?: string;
  sub: string;
};
type MailSettings = {
  from_email: string | null;
  from_name: string;
  is_enabled: boolean;
  provider: string;
  reply_to_email: string | null;
  smtp_host: string | null;
  smtp_password_secret_name: string;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  updated_at: string;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const sendTestRoles: UserRole[] = ["admin", "owner"];

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Mail Settings",
};

function settingValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not set";

  return String(value);
}

function updatedDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminMailSettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", claims.sub)
    .maybeSingle<{ username: string; display_name: string; role: UserRole }>();

  if (!profile || !viewRoles.includes(profile.role)) {
    redirect("/admin");
  }

  const canSendMailTest = sendTestRoles.includes(profile.role);
  const hasAuthEmailLookup = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: mailSettings } = await supabase
    .from("mail_settings")
    .select(
      "provider, from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled, updated_at",
    )
    .maybeSingle<MailSettings>();

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <section className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-[var(--card-rim)] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to admin dashboard"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)]"
              href="/admin"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
                Admin
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Mail settings</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                SMTP status, sender identity, and test email tools.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm">
            <p className="font-semibold">{profile.display_name}</p>
            <p className="text-xs text-[var(--muted-strong)]">
              @{profile.username} - {profile.role}
            </p>
          </div>
        </header>

        <AdminSectionNav activeHref="/admin/mail-settings" />

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Provider</p>
            <p className="mt-2 text-2xl font-bold capitalize">
              {mailSettings?.provider ?? "hostgator"}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Sending</p>
            <p className="mt-2 text-2xl font-bold">
              {mailSettings?.is_enabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Secure SMTP</p>
            <p className="mt-2 text-2xl font-bold">
              {mailSettings?.smtp_secure ? "Yes" : "No"}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Auth email lookup</p>
            <p className="mt-2 text-2xl font-bold">
              {hasAuthEmailLookup ? "Ready" : "Missing"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Mail className="size-5 text-[var(--gold)]" />
              <h2 className="text-lg font-bold">SMTP configuration</h2>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  From name
                </dt>
                <dd className="mt-1 font-semibold">
                  {mailSettings?.from_name ?? "TheTattooCore"}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  From email
                </dt>
                <dd className="mt-1 font-semibold">
                  {settingValue(mailSettings?.from_email)}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  Reply-to
                </dt>
                <dd className="mt-1 font-semibold">
                  {settingValue(mailSettings?.reply_to_email)}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  SMTP host
                </dt>
                <dd className="mt-1 font-semibold">
                  {settingValue(mailSettings?.smtp_host)}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  SMTP port
                </dt>
                <dd className="mt-1 font-semibold">
                  {settingValue(mailSettings?.smtp_port)}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  SMTP username
                </dt>
                <dd className="mt-1 font-semibold">
                  {settingValue(mailSettings?.smtp_username)}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  Secret binding
                </dt>
                <dd className="mt-1 font-semibold">
                  {mailSettings?.smtp_password_secret_name ??
                    "HOSTGATOR_SMTP_PASSWORD"}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
                <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  Last updated
                </dt>
                <dd className="mt-1 font-semibold">
                  {updatedDate(mailSettings?.updated_at)}
                </dd>
              </div>
            </dl>
          </section>

          <aside className="space-y-4">
            <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
              <div className="mb-4 flex items-center gap-3">
                <Send className="size-5 text-[var(--gold)]" />
                <h2 className="text-lg font-bold">SMTP test</h2>
              </div>
              <MailTestForm
                defaultRecipient={claims.email}
                disabled={!mailSettings?.is_enabled || !canSendMailTest}
              />
              {!mailSettings?.is_enabled ? (
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Mail sending is disabled in settings.
                </p>
              ) : !canSendMailTest ? (
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Admin or owner role required to send tests.
                </p>
              ) : null}
            </section>

            <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="size-5 text-[var(--gold)]" />
                <h2 className="text-lg font-bold">Guardrails</h2>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <li>Keep passwords in Cloudflare secrets, never in source code.</li>
                <li>Use HostGator SMTP for transactional account mail only.</li>
                <li>
                  Add the server-only Supabase service role secret before
                  verification-decision email can look up member addresses.
                </li>
                <li>Check inbox and junk when testing deliverability.</li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
