import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type StripeWebhookEvent = {
  event_id: string;
  event_type: string;
  received_at: string;
};
type StatusRow = {
  status: string;
};
type AdPaymentStatusRow = {
  payment_status: string;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Payments",
};

function countByStatus(rows: StatusRow[] | AdPaymentStatusRow[] | null) {
  const counts = new Map<string, number>();

  for (const row of rows ?? []) {
    const status =
      "payment_status" in row ? row.payment_status : row.status;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminPaymentsPage() {
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

  const adminClient = createAdminClient();
  const [
    { data: stripeEvents },
    { data: merchStatuses },
    { data: adStatuses },
  ] = adminClient
    ? await Promise.all([
        adminClient
          .from("stripe_webhook_events")
          .select("event_id, event_type, received_at")
          .order("received_at", { ascending: false })
          .limit(50)
          .returns<StripeWebhookEvent[]>(),
        adminClient
          .from("merch_orders")
          .select("status")
          .order("created_at", { ascending: false })
          .limit(1000)
          .returns<StatusRow[]>(),
        adminClient
          .from("ad_campaigns")
          .select("payment_status")
          .order("created_at", { ascending: false })
          .limit(1000)
          .returns<AdPaymentStatusRow[]>(),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const merchStatusCounts = countByStatus(merchStatuses);
  const adStatusCounts = countByStatus(adStatuses);

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <section className="ttc-page-panel mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
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
              <h1 className="text-2xl font-bold sm:text-3xl">Payments</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                Stripe webhook receipts, Merch order states, and ad payment states.
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

        <AdminSectionNav activeHref="/admin/payments" />

        {!adminClient ? (
          <section className="ttc-card rounded-lg border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--paper-warm))] p-5">
            <ShieldAlert className="size-5 text-[var(--danger)]" />
            <h2 className="mt-3 text-lg font-bold">Service role unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Add the Supabase service role secret before reading private Stripe
              event receipts.
            </p>
          </section>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <ReceiptText className="size-5 text-[var(--gold)]" />
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Stripe events
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {stripeEvents?.length ?? 0}
                </p>
              </div>
              <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <CreditCard className="size-5 text-[var(--gold)]" />
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Merch orders sampled
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {merchStatuses?.length ?? 0}
                </p>
              </div>
              <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
                <BadgeCheck className="size-5 text-[var(--gold)]" />
                <p className="mt-3 text-sm text-[var(--muted-strong)]">
                  Ad payments sampled
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {adStatuses?.length ?? 0}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                <h2 className="text-lg font-bold">Recent Stripe events</h2>
                <div className="mt-4 space-y-2">
                  {stripeEvents?.length ? (
                    stripeEvents.map((event) => (
                      <article
                        className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                        key={event.event_id}
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <p className="break-all text-sm font-bold">
                            {event.event_type}
                          </p>
                          <p className="shrink-0 text-xs text-[var(--muted-strong)]">
                            {formatDateTime(event.received_at)}
                          </p>
                        </div>
                        <p className="mt-1 break-all text-xs text-[var(--muted-strong)]">
                          {event.event_id}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-[var(--card-rim)] p-4 text-sm text-[var(--muted)]">
                      No Stripe webhook events have been recorded yet.
                    </p>
                  )}
                </div>
              </section>

              <aside className="space-y-4">
                <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                  <h2 className="text-lg font-bold">Merch order states</h2>
                  <div className="mt-3 space-y-2">
                    {merchStatusCounts.length ? (
                      merchStatusCounts.map(([status, count]) => (
                        <div
                          className="flex items-center justify-between rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm"
                          key={status}
                        >
                          <span className="font-semibold">{status}</span>
                          <span className="text-[var(--muted-strong)]">
                            {count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No Merch orders found.
                      </p>
                    )}
                  </div>
                </section>

                <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
                  <h2 className="text-lg font-bold">Ad payment states</h2>
                  <div className="mt-3 space-y-2">
                    {adStatusCounts.length ? (
                      adStatusCounts.map(([status, count]) => (
                        <div
                          className="flex items-center justify-between rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm"
                          key={status}
                        >
                          <span className="font-semibold">{status}</span>
                          <span className="text-[var(--muted-strong)]">
                            {count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No ad payment states found.
                      </p>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
