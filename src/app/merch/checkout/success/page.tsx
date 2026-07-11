import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Order = {
  created_at: string;
  currency: string;
  discount_cents: number;
  id: string;
  platform_fee_cents: number;
  shipping_cents: number;
  subtotal_cents: number;
  status: string;
  tax_cents: number;
  total_cents: number;
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
  const { data: order } = sessionId
    ? await supabase
        .from("merch_orders")
        .select(
          "id, status, currency, subtotal_cents, platform_fee_cents, shipping_cents, tax_cents, discount_cents, total_cents, created_at",
        )
        .eq("stripe_checkout_session_id", sessionId)
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
              <dl className="mt-3 grid gap-2 text-[var(--muted)]">
                <div className="flex justify-between gap-3">
                  <dt>Status</dt>
                  <dd className="font-semibold capitalize text-[var(--foreground)]">
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
            </div>
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
              href="/account"
            >
              Account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
