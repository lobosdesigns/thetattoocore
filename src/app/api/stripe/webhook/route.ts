import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createStripeClient, stripeCryptoProvider } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function stripeResponse(message: string, status = 200) {
  return NextResponse.json({ message }, { status });
}

type PaidOrderTransition = {
  id: string;
};

function metadataCents(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function markCheckoutSession({
  session,
  status,
}: {
  session: Stripe.Checkout.Session;
  status: "cancelled" | "paid" | "payment_failed";
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const now = new Date().toISOString();
  const shippingDetails = (
    session as Stripe.Checkout.Session & {
      collected_information?: {
        shipping_details?: {
          address?: Stripe.Address | null;
          name?: string | null;
        } | null;
      } | null;
      shipping_details?: {
        address?: Stripe.Address | null;
        name?: string | null;
      } | null;
    }
  );
  const collectedShippingDetails =
    shippingDetails.collected_information?.shipping_details ??
    shippingDetails.shipping_details;
  const platformFeeCents = metadataCents(
    session.metadata?.platform_fee_cents,
    0,
  );
  const subtotalCents = metadataCents(
    session.metadata?.merch_subtotal_cents,
    Math.max(0, (session.amount_subtotal ?? 0) - platformFeeCents),
  );
  const updateValues = {
    customer_email: session.customer_details?.email ?? session.customer_email ?? null,
    shipping_address: collectedShippingDetails
      ? {
          address: collectedShippingDetails.address,
          name: collectedShippingDetails.name,
        }
      : {},
    shipping_name: collectedShippingDetails?.name ?? null,
    status,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    platform_fee_cents: platformFeeCents,
    subtotal_cents: subtotalCents,
    tax_cents: session.total_details?.amount_tax ?? 0,
    shipping_cents: session.total_details?.amount_shipping ?? 0,
    discount_cents: session.total_details?.amount_discount ?? 0,
    total_cents: session.amount_total ?? 0,
    updated_at: now,
    ...(status === "cancelled" ? { cancelled_at: now } : {}),
  };

  const query = supabase
    .from("merch_orders")
    .update(updateValues)
    .eq("stripe_checkout_session_id", session.id);
  const { data: transitionedPaidOrders, error } =
    status === "paid"
      ? await query
          .neq("status", "paid")
          .neq("status", "fulfilled")
          .select("id")
          .returns<PaidOrderTransition[]>()
      : await query.select("id").returns<PaidOrderTransition[]>();

  if (error) {
    throw new Error(error.message || "Could not update merch order.");
  }

  if (status === "paid") {
    for (const order of transitionedPaidOrders ?? []) {
      const { error: inventoryError } = await supabase.rpc(
        "decrement_merch_inventory_for_order",
        { p_order_id: order.id },
      );

      if (inventoryError) {
        throw new Error(
          inventoryError.message || "Could not update merch inventory.",
        );
      }
    }
  }
}

async function markAdCheckoutSession({
  session,
  status,
}: {
  session: Stripe.Checkout.Session;
  status: "paid" | "payment_failed";
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const campaignId = session.metadata?.ad_campaign_id;
  if (!campaignId) {
    throw new Error("Missing ad campaign id on Stripe session.");
  }

  const now = new Date().toISOString();
  const platformFeeCents = metadataCents(session.metadata?.platform_fee_cents, 0);
  const prepaidAmountCents = metadataCents(
    session.metadata?.prepaid_amount_cents,
    Math.max(0, (session.amount_total ?? 0) - platformFeeCents),
  );
  const { error } = await supabase
    .from("ad_campaigns")
    .update({
      paid_at: status === "paid" ? now : null,
      payment_status: status,
      platform_fee_cents: platformFeeCents,
      prepaid_amount_cents: prepaidAmountCents,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      updated_at: now,
    })
    .eq("id", campaignId)
    .eq("stripe_checkout_session_id", session.id);

  if (error) {
    throw new Error(error.message || "Could not update ad payment status.");
  }
}

async function markRefunded(paymentIntentId: string, fullyRefunded: boolean) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const { error } = await supabase
    .from("merch_orders")
    .update({
      refunded_at: new Date().toISOString(),
      status: fullyRefunded ? "refunded" : "partially_refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentId);

  if (error) {
    throw new Error(error.message || "Could not update merch refund status.");
  }
}

export async function POST(request: Request) {
  const stripe = createStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return stripeResponse("Stripe webhook is not configured.", 500);
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return stripeResponse("Missing Stripe signature.", 400);
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      stripeCryptoProvider,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook.";

    return stripeResponse(message, 400);
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.payment_kind === "ad_campaign") {
        await markAdCheckoutSession({ session, status: "paid" });
      } else {
        await markCheckoutSession({
          session,
          status: "paid",
        });
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.payment_kind === "ad_campaign") {
        await markAdCheckoutSession({ session, status: "payment_failed" });
      } else {
        await markCheckoutSession({
          session,
          status: "payment_failed",
        });
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.payment_kind === "ad_campaign") {
        await markAdCheckoutSession({ session, status: "payment_failed" });
      } else {
        await markCheckoutSession({
          session,
          status: "cancelled",
        });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : null;

      if (paymentIntentId) {
        await markRefunded(paymentIntentId, charge.amount_refunded >= charge.amount);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process Stripe webhook.";

    return stripeResponse(message, 500);
  }

  return stripeResponse("ok");
}
