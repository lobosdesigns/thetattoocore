import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Order = {
  created_at: string;
  currency: string;
  discount_cents: number;
  id: string;
  merch_order_items: {
    line_total_cents: number;
    quantity: number;
    title_snapshot: string;
    unit_price_cents: number;
  }[];
  platform_fee_cents: number;
  shipping_cents: number;
  subtotal_cents: number;
  status: string;
  tax_cents: number;
  total_cents: number;
};
type Claims = {
  sub: string;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Merch checkout status",
};

function money(cents: number, currency: string) {
  return Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function formatReceiptDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status?: string) {
  if (status === "paid" || status === "fulfilled") {
    return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  }

  if (status === "payment_failed" || status === "cancelled") {
    return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
  }

  return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
}

function statusCopy(status?: string) {
  if (status === "paid" || status === "fulfilled") {
    return {
      heading: "Payment confirmed",
      message:
        "Stripe confirmed the payment. You can track fulfillment from your account orders.",
    };
  }

  if (status === "payment_failed" || status === "cancelled") {
    return {
      heading: "Checkout was not completed",
      message:
        "Stripe did not confirm this payment. No fulfillment should start for this order.",
    };
  }

  if (status === "refunded" || status === "partially_refunded") {
    return {
      heading: "Refund status updated",
      message:
        "Stripe reported a refund update. Check your account orders for the latest status.",
    };
  }

  return {
    heading: "Checkout received",
    message:
      "Stripe is processing the payment result. The order status updates after the webhook confirms it.",
  };
}

export default async function MerchCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  const { data: order } = sessionId && claims?.sub
    ? await supabase
        .from("merch_orders")
        .select(
          "id, status, currency, subtotal_cents, platform_fee_cents, shipping_cents, tax_cents, discount_cents, total_cents, created_at, merch_order_items(title_snapshot, quantity, unit_price_cents, line_total_cents)",
        )
        .eq("stripe_checkout_session_id", sessionId)
        .eq("buyer_id", claims.sub)
        .maybeSingle<Order>()
    : { data: null };
  const copy = statusCopy(order?.status);

  return (
    <main className="ttc-page min-h-screen">
      <section className="ttc-page-panel mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
        <div className="ttc-card w-full rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-[var(--gold)]" />
          <h1 className="mt-4 text-2xl font-bold">{copy.heading}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {copy.message}
          </p>
          {order ? (
            <div className="mt-5 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4 text-left text-sm">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-[var(--gold)]" />
                <p className="font-semibold">Order {order.id.slice(0, 8)}</p>
              </div>
              <p className="mt-2 text-xs text-[var(--muted-strong)]">
                Created {formatReceiptDate(order.created_at)}
              </p>
              <dl className="mt-3 grid gap-2 text-[var(--muted)]">
                {order.merch_order_items.length ? (
                  <div className="border-b border-[var(--card-rim)] pb-2">
                    <dt className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                      Items
                    </dt>
                    <dd className="mt-2 space-y-1 text-[var(--foreground)]">
                      {order.merch_order_items.map((item) => (
                        <div
                          className="flex justify-between gap-3"
                          key={`${item.title_snapshot}-${item.quantity}-${item.line_total_cents}`}
                        >
                          <span>
                            {item.quantity} x {item.title_snapshot}
                          </span>
                          <span className="font-semibold">
                            {money(item.line_total_cents, order.currency)}
                          </span>
                        </div>
                      ))}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt>Status</dt>
                  <dd
                    className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${statusClass(
                      order.status,
                    )}`}
                  >
                    {order.status.replace("_", " ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {money(order.subtotal_cents, order.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>TTC platform fee</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {money(order.platform_fee_cents, order.currency)}
                  </dd>
                </div>
                {order.shipping_cents > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt>Shipping</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {money(order.shipping_cents, order.currency)}
                    </dd>
                  </div>
                ) : null}
                {order.tax_cents > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt>Tax</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {money(order.tax_cents, order.currency)}
                    </dd>
                  </div>
                ) : null}
                {order.discount_cents > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt>Discount</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      -{money(order.discount_cents, order.currency)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-t border-[var(--card-rim)] pt-2">
                  <dt>Total</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {money(order.total_cents, order.currency)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_90%,transparent)] p-3 text-xs leading-5 text-[var(--muted-strong)]">
                Fulfillment starts only after payment is confirmed and seller/admin
                review rules are satisfied. Refunds and disputes are handled
                through Stripe records.
              </p>
            </div>
          ) : sessionId && !claims?.sub ? (
            <p className="mt-5 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4 text-sm leading-6 text-[var(--muted)]">
              Sign in with the buying account to view this order receipt.
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              className="flex h-11 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
              href="/#merch"
            >
              Back to Merch
            </Link>
            <Link
              className="flex h-11 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 text-sm font-semibold"
              href="/account#order-settings"
            >
              Account orders
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
