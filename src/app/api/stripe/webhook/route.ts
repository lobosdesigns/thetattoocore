import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { sendHostgatorEmail } from "@/lib/mail/hostgator";
import { siteName, siteUrl, supportEmail } from "@/lib/site";
import { createStripeClient, stripeCryptoProvider } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function stripeResponse(message: string, status = 200) {
  return NextResponse.json({ message }, { status });
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

type PaidOrderTransition = {
  id: string;
};
type RefundedOrderTransition = {
  buyer_id: string;
  id: string;
};
type MerchOrderPaymentProblemTransition = {
  buyer_id: string;
  id: string;
};
type RefundedAdTransition = {
  advertiser_id: string;
  id: string;
  title: string;
};
type AdPaymentTransition = {
  advertiser_id: string;
  id: string;
  title: string;
};
type PaidOrderRpcArgs = {
  p_checkout_session_id: string;
  p_customer_email: string | null;
  p_discount_cents: number;
  p_payment_intent_id: string | null;
  p_platform_fee_cents: number;
  p_shipping_address: Record<string, unknown>;
  p_shipping_cents: number;
  p_shipping_name: string | null;
  p_subtotal_cents: number;
  p_tax_cents: number;
  p_total_cents: number;
};
type AdminSupabase = NonNullable<ReturnType<typeof createAdminClient>>;
type MailSettings = {
  from_email: string | null;
  from_name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_secure: boolean;
  smtp_password_secret_name: string;
  reply_to_email: string | null;
  is_enabled: boolean;
};
type OrderProductRow = {
  product_id: string;
};
type PaidOrderItemNotificationRow = {
  order_id: string;
  product_id: string | null;
  quantity: number;
  seller_id: string;
  title_snapshot: string;
};

function metadataCents(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isEmail(value?: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function maybeSendPaymentEmail({
  headerKind,
  htmlBody,
  subject,
  supabase,
  textBody,
  userId,
}: {
  headerKind: string;
  htmlBody: string;
  subject: string;
  supabase: AdminSupabase;
  textBody: string;
  userId: string;
}) {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, notify_email_important, username")
      .eq("id", userId)
      .maybeSingle<{
        display_name: string | null;
        notify_email_important: boolean | null;
        username: string | null;
      }>(),
    supabase
      .from("mail_settings")
      .select(
        "from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
      )
      .maybeSingle<MailSettings>(),
  ]);

  if (profile?.notify_email_important === false || !settings?.is_enabled) {
    return;
  }

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(userId);

  if (userError) {
    console.error("Payment email user lookup failed", userError);
    return;
  }

  const recipientEmail = userData.user?.email;
  if (!isEmail(recipientEmail)) return;

  const displayName = profile?.display_name || profile?.username || "there";

  try {
    await sendHostgatorEmail({
      headers: {
        "X-TheTattooCore-Transactional": headerKind,
      },
      html: [
        `<h1>${escapeHtml(subject)}</h1>`,
        `<p>Hi ${escapeHtml(displayName)},</p>`,
        `<p>${escapeHtml(htmlBody)}</p>`,
        `<p>Open <a href="${siteUrl}/account">${siteName} Account</a> to review the latest order or payment status.</p>`,
        `<p>For help, email <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`,
      ].join(""),
      recipientEmail,
      settings,
      subject,
      text: [
        subject,
        "",
        `Hi ${displayName},`,
        "",
        textBody,
        "",
        `Open Account: ${siteUrl}/account`,
        `Help: ${supportEmail}`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("Payment email failed", error);
  }
}

async function revalidateMerchOrderProducts(
  supabase: AdminSupabase,
  orderIds: string[],
) {
  if (!orderIds.length) return;

  const { data: items } = await supabase
    .from("merch_order_items")
    .select("product_id")
    .in("order_id", orderIds)
    .returns<OrderProductRow[]>();
  const productIds = new Set(
    (items ?? []).map((item) => item.product_id).filter(Boolean),
  );

  for (const productId of productIds) {
    revalidatePath(`/merch/${productId}`);
  }
}

async function notifyMerchSellersAboutPaidOrders(
  supabase: AdminSupabase,
  orderIds: string[],
) {
  if (!orderIds.length) return;

  const { data: items } = await supabase
    .from("merch_order_items")
    .select("order_id, product_id, seller_id, title_snapshot, quantity")
    .in("order_id", orderIds)
    .returns<PaidOrderItemNotificationRow[]>();

  const notifications = (items ?? []).map((item) => ({
    actor_id: null,
    body: "A paid Merch order is ready for fulfillment.",
    href: "/account#order-settings",
    recipient_id: item.seller_id,
    subject_id: item.product_id ?? item.order_id,
    subject_type: item.product_id ? "merch_product" : "merch_order",
    title: `New paid Merch sale: ${item.quantity} x ${item.title_snapshot}`.slice(
      0,
      120,
    ),
    type: "merch_paid",
  }));

  if (notifications.length) {
    await supabase.from("notifications").insert(notifications);
    revalidatePath("/notifications");
  }

  for (const item of items ?? []) {
    await maybeSendPaymentEmail({
      headerKind: "merch-paid-seller",
      htmlBody: `A paid Merch sale is ready for fulfillment: ${item.quantity} x ${item.title_snapshot}.`,
      subject: `${siteName} paid Merch sale`,
      supabase,
      textBody: `A paid Merch sale is ready for fulfillment: ${item.quantity} x ${item.title_snapshot}.`,
      userId: item.seller_id,
    });
  }
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

  if (status === "paid") {
    const { data: transitionedPaidOrders, error } = await supabase
      .rpc("mark_paid_merch_order_for_checkout", {
        p_checkout_session_id: session.id,
        p_customer_email:
          session.customer_details?.email ?? session.customer_email ?? null,
        p_discount_cents: session.total_details?.amount_discount ?? 0,
        p_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        p_platform_fee_cents: platformFeeCents,
        p_shipping_address: collectedShippingDetails
          ? {
              address: collectedShippingDetails.address,
              name: collectedShippingDetails.name,
            }
          : {},
        p_shipping_cents: session.total_details?.amount_shipping ?? 0,
        p_shipping_name: collectedShippingDetails?.name ?? null,
        p_subtotal_cents: subtotalCents,
        p_tax_cents: session.total_details?.amount_tax ?? 0,
        p_total_cents: session.amount_total ?? 0,
      } satisfies PaidOrderRpcArgs)
      .returns<PaidOrderTransition[]>();

    if (error) {
      throw new Error(error.message || "Could not mark merch order paid.");
    }

    const paidOrderRows = Array.isArray(transitionedPaidOrders)
      ? transitionedPaidOrders
      : [];

    await revalidateMerchOrderProducts(
      supabase,
      paidOrderRows.map((order) => order.id),
    );
    await notifyMerchSellersAboutPaidOrders(
      supabase,
      paidOrderRows.map((order) => order.id),
    );
    revalidatePath("/account");
    revalidatePath("/admin");
    revalidatePath("/admin/merch");
    return;
  }

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

  const { data: transitionedOrders, error } = await supabase
    .from("merch_orders")
    .update(updateValues)
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "pending_checkout")
    .select("id, buyer_id")
    .returns<MerchOrderPaymentProblemTransition[]>();

  if (error) {
    throw new Error(error.message || "Could not update merch order.");
  }

  if (status === "cancelled" || status === "payment_failed") {
    for (const order of transitionedOrders ?? []) {
      const { error: releaseError } = await supabase.rpc(
        "release_merch_inventory_for_order",
        { p_order_id: order.id },
      );

      if (releaseError) {
        throw new Error(
          releaseError.message || "Could not release merch inventory hold.",
        );
      }
    }
  }

  const buyerPaymentNotifications = (transitionedOrders ?? []).map((order) => ({
    actor_id: null,
    body:
      status === "cancelled"
        ? "Stripe checkout expired or was cancelled, so this Merch order was not completed."
        : "Stripe reported this Merch payment failed, so this order was not completed.",
    href: "/account#order-settings",
    recipient_id: order.buyer_id,
    subject_id: order.id,
    subject_type: "merch_order",
    title:
      status === "cancelled"
        ? "Merch checkout cancelled"
        : "Merch payment failed",
    type: status === "cancelled" ? "merch_cancelled" : "merch_payment_failed",
  }));

  if (buyerPaymentNotifications.length) {
    await supabase.from("notifications").insert(buyerPaymentNotifications);
    revalidatePath("/notifications");
  }

  for (const order of transitionedOrders ?? []) {
    await maybeSendPaymentEmail({
      headerKind:
        status === "cancelled"
          ? "merch-checkout-cancelled"
          : "merch-payment-failed",
      htmlBody:
        status === "cancelled"
          ? "Stripe checkout expired or was cancelled, so your Merch order was not completed."
          : "Stripe reported your Merch payment failed, so your order was not completed.",
      subject:
        status === "cancelled"
          ? `${siteName} Merch checkout cancelled`
          : `${siteName} Merch payment failed`,
      supabase,
      textBody:
        status === "cancelled"
          ? "Stripe checkout expired or was cancelled, so your Merch order was not completed."
          : "Stripe reported your Merch payment failed, so your order was not completed.",
      userId: order.buyer_id,
    });
  }

  await revalidateMerchOrderProducts(
    supabase,
    (transitionedOrders ?? []).map((order) => order.id),
  );
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/merch");
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
  const { data: transitionedCampaigns, error } = await supabase
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
    .eq("stripe_checkout_session_id", session.id)
    .in(
      "payment_status",
      status === "paid"
        ? ["checkout_started", "payment_failed"]
        : ["checkout_started"],
    )
    .select("id, advertiser_id, title")
    .returns<AdPaymentTransition[]>();

  if (error) {
    throw new Error(error.message || "Could not update ad payment status.");
  }

  const adPaymentNotifications = (transitionedCampaigns ?? []).map((campaign) => ({
    actor_id: null,
    body:
      status === "paid"
        ? "Stripe received payment for this ad campaign."
        : "Stripe reported that this ad campaign payment failed.",
    href: "/account#advertising-settings",
    recipient_id: campaign.advertiser_id,
    subject_id: campaign.id,
    subject_type: "ad_campaign",
    title:
      status === "paid"
        ? `Ad payment received: ${campaign.title}`.slice(0, 120)
        : `Ad payment failed: ${campaign.title}`.slice(0, 120),
    type: status === "paid" ? "ad_paid" : "ad_payment_failed",
  }));

  if (adPaymentNotifications.length) {
    await supabase.from("notifications").insert(adPaymentNotifications);
    revalidatePath("/notifications");
  }

  for (const campaign of transitionedCampaigns ?? []) {
    const paid = status === "paid";
    const body = paid
      ? `Stripe received payment for your ad campaign: ${campaign.title}.`
      : `Stripe reported that payment failed for your ad campaign: ${campaign.title}.`;

    await maybeSendPaymentEmail({
      headerKind: paid ? "ad-paid-advertiser" : "ad-payment-failed-advertiser",
      htmlBody: body,
      subject: paid
        ? `${siteName} ad payment received`
        : `${siteName} ad payment failed`,
      supabase,
      textBody: body,
      userId: campaign.advertiser_id,
    });
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/ads");
}

async function markRefunded(paymentIntentId: string, fullyRefunded: boolean) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const now = new Date().toISOString();
  let refundedOrderQuery = supabase
    .from("merch_orders")
    .update({
      refunded_at: now,
      status: fullyRefunded ? "refunded" : "partially_refunded",
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId);

  refundedOrderQuery = fullyRefunded
    ? refundedOrderQuery.neq("status", "refunded")
    : refundedOrderQuery.eq("status", "paid");

  const { data: refundedOrders, error } = await refundedOrderQuery
    .select("id, buyer_id")
    .returns<RefundedOrderTransition[]>();

  if (error) {
    throw new Error(error.message || "Could not update merch refund status.");
  }

  await revalidateMerchOrderProducts(
    supabase,
    (refundedOrders ?? []).map((order) => order.id),
  );
  const refundNotifications = (refundedOrders ?? []).map((order) => ({
    actor_id: null,
    body: fullyRefunded
      ? "Stripe reported a full refund for this Merch order."
      : "Stripe reported a partial refund for this Merch order.",
    href: "/account#order-settings",
    recipient_id: order.buyer_id,
    subject_id: order.id,
    subject_type: "merch_order",
    title: fullyRefunded ? "Merch order refunded" : "Merch order partially refunded",
    type: "merch_refunded",
  }));

  if (refundNotifications.length) {
    await supabase.from("notifications").insert(refundNotifications);
  }

  for (const order of refundedOrders ?? []) {
    const body = fullyRefunded
      ? "Stripe reported a full refund for your Merch order."
      : "Stripe reported a partial refund for your Merch order.";

    await maybeSendPaymentEmail({
      headerKind: fullyRefunded
        ? "merch-refunded-buyer"
        : "merch-partially-refunded-buyer",
      htmlBody: body,
      subject: fullyRefunded
        ? `${siteName} Merch order refunded`
        : `${siteName} Merch order partially refunded`,
      supabase,
      textBody: body,
      userId: order.buyer_id,
    });
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/merch");
  revalidatePath("/notifications");

  if (!fullyRefunded) return;

  const { data: refundedAds, error: adError } = await supabase
    .from("ad_campaigns")
    .update({
      payment_status: "refunded",
      refunded_at: now,
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .neq("payment_status", "refunded")
    .select("id, advertiser_id, title")
    .returns<RefundedAdTransition[]>();

  if (adError) {
    throw new Error(adError.message || "Could not update ad refund status.");
  }

  const adRefundNotifications = (refundedAds ?? []).map((campaign) => ({
    actor_id: null,
    body: "Stripe reported a full refund for this ad payment.",
    href: "/account#advertising-settings",
    recipient_id: campaign.advertiser_id,
    subject_id: campaign.id,
    subject_type: "ad_campaign",
    title: `Ad payment refunded: ${campaign.title}`.slice(0, 120),
    type: "ad_refunded",
  }));

  if (adRefundNotifications.length) {
    await supabase.from("notifications").insert(adRefundNotifications);
  }

  for (const campaign of refundedAds ?? []) {
    await maybeSendPaymentEmail({
      headerKind: "ad-refunded-advertiser",
      htmlBody: `Stripe reported a full refund for your ad payment: ${campaign.title}.`,
      subject: `${siteName} ad payment refunded`,
      supabase,
      textBody: `Stripe reported a full refund for your ad payment: ${campaign.title}.`,
      userId: campaign.advertiser_id,
    });
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/ads");
  revalidatePath("/admin/merch");
  revalidatePath("/notifications");
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
    const supabase = createAdminClient();

    if (!supabase) {
      throw new Error("Missing Supabase service role key for Stripe webhook.");
    }

    const { data: processedEvent, error: processedEventError } = await supabase
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle<{ event_id: string }>();

    if (processedEventError) {
      throw new Error(
        processedEventError.message || "Could not check Stripe event status.",
      );
    }

    if (processedEvent) {
      return stripeResponse("Stripe event already processed.");
    }

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

    const { error: recordEventError } = await supabase
      .from("stripe_webhook_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
      });

    if (recordEventError && !isUniqueViolation(recordEventError)) {
      throw new Error(
        recordEventError.message || "Could not record Stripe event status.",
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process Stripe webhook.";

    return stripeResponse(message, 500);
  }

  return stripeResponse("ok");
}
