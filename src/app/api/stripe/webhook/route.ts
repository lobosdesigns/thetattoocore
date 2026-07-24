import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { sendHostgatorEmail } from "@/lib/mail/hostgator";
import { insertNotifications } from "@/lib/notification-write";
import { siteName, siteUrl, supportEmail } from "@/lib/site";
import {
  createStripeClient,
  expectedStripeLivemode,
  stripeSecretKeyLivemode,
  stripeCryptoProvider,
} from "@/lib/stripe/server";
import { stripeConnectStatus } from "@/lib/stripe/connect";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function stripeResponse(message: string, status = 200) {
  return NextResponse.json({ message }, { status });
}

function stripeLivemodeMatches(event: Stripe.Event) {
  const expected = expectedStripeLivemode() ?? stripeSecretKeyLivemode();

  return expected !== null && event.livemode === expected;
}

function checkoutSessionIsSettled(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  return (
    event.type === "checkout.session.async_payment_succeeded" ||
    session.payment_status === "paid"
  );
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
type RefundedBookingTransition = {
  artist_id: string;
  client_id: string;
  id: string;
  title: string;
};
type DisputedAdPayment = {
  id: string;
  title: string;
};
type DisputedBookingPayment = {
  id: string;
  title: string;
};
type DisputedMerchPayment = {
  id: string;
};
type RefundProblemMerch = {
  id: string;
  status: string;
};
type RefundProblemAd = {
  id: string;
  payment_status: string;
  status: string;
  title: string;
};
type RefundProblemBooking = {
  id: string;
  payment_status: string;
  status: string;
  title: string;
};
type AdPaymentTransition = {
  advertiser_id: string;
  id: string;
  title: string;
};
type BookingPaymentTransition = {
  artist_id: string;
  client_id: string;
  id: string;
  title: string;
};
type NotificationInsert = {
  actor_id: string | null;
  body: string;
  href: string;
  recipient_id: string;
  subject_id: string;
  subject_type: string;
  title: string;
  type: string;
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
type ProblemOrderRpcArgs = PaidOrderRpcArgs & {
  p_status: "cancelled" | "payment_failed";
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
const disputeWebhookEvents = [
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
] as const;

function metadataCents(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isMerchCheckoutSession(session: Stripe.Checkout.Session) {
  return (
    session.metadata?.payment_kind === "merch_order" ||
    Boolean(session.metadata?.merch_order_id)
  );
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
        `<p>Open <a href="${siteUrl}/settings/orders">${siteName} Settings</a> to review the latest order or payment status.</p>`,
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
        `Open Settings: ${siteUrl}/settings/orders`,
        `Help: ${supportEmail}`,
      ].join("\n"),
    });
  } catch {
    console.error("Payment email failed.");
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

async function syncStripeConnectAccountFromWebhook(
  supabase: AdminSupabase,
  account: Stripe.Account,
  livemode: boolean,
) {
  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("stripe_connect_accounts")
    .select("profile_id")
    .eq("stripe_account_id", account.id)
    .eq("livemode", livemode)
    .maybeSingle<{ profile_id: string }>();

  if (existingAccountError) {
    console.error("Webhook connected account lookup failed.", existingAccountError);
    throw new Error("Could not read Stripe Connect account.");
  }

  if (!existingAccount) {
    console.warn("Ignoring Stripe Connect account update for unknown account", {
      stripeAccountId: account.id,
    });
    return;
  }

  const { error: updateError } = await supabase
    .from("stripe_connect_accounts")
    .update(stripeConnectStatus(account, livemode))
    .eq("profile_id", existingAccount.profile_id)
    .eq("stripe_account_id", account.id)
    .eq("livemode", livemode);

  if (updateError) {
    console.error("Webhook connected account sync failed.", updateError);
    throw new Error("Could not sync Stripe Connect account.");
  }

  revalidatePath("/account");
  revalidatePath("/admin/users");
  revalidatePath("/admin/verification");
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
    await insertNotifications(notifications);
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
      console.error("Webhook Merch paid order transition failed.", error);
      throw new Error("Could not mark merch order paid.");
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

  const { data: transitionedOrders, error } = await supabase
    .rpc("mark_problem_merch_order_for_checkout", {
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
      p_status: status,
      p_subtotal_cents: subtotalCents,
      p_tax_cents: session.total_details?.amount_tax ?? 0,
      p_total_cents: session.amount_total ?? 0,
    } satisfies ProblemOrderRpcArgs)
    .returns<MerchOrderPaymentProblemTransition[]>();

  if (error) {
    console.error("Webhook Merch order payment update failed.", error);
    throw new Error("Could not update merch order.");
  }

  const paymentProblemRows = Array.isArray(transitionedOrders)
    ? transitionedOrders
    : [];
  const buyerPaymentNotifications = paymentProblemRows.map((order) => ({
    actor_id: null,
    body:
      status === "cancelled"
        ? "Checkout expired or was cancelled, so this Merch order was not completed."
        : "This Merch payment failed, so this order was not completed.",
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
    await insertNotifications(buyerPaymentNotifications);
    revalidatePath("/notifications");
  }

  for (const order of paymentProblemRows) {
    await maybeSendPaymentEmail({
      headerKind:
        status === "cancelled"
          ? "merch-checkout-cancelled"
          : "merch-payment-failed",
      htmlBody:
        status === "cancelled"
          ? "Checkout expired or was cancelled, so your Merch order was not completed."
          : "Your Merch payment failed, so your order was not completed.",
      subject:
        status === "cancelled"
          ? `${siteName} Merch checkout cancelled`
          : `${siteName} Merch payment failed`,
      supabase,
      textBody:
        status === "cancelled"
          ? "Checkout expired or was cancelled, so your Merch order was not completed."
          : "Your Merch payment failed, so your order was not completed.",
      userId: order.buyer_id,
    });
  }

  await revalidateMerchOrderProducts(
    supabase,
    paymentProblemRows.map((order) => order.id),
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
    console.error("Webhook ad payment status update failed.", error);
    throw new Error("Could not update ad payment status.");
  }

  const adPaymentNotifications = (transitionedCampaigns ?? []).map((campaign) => ({
    actor_id: null,
    body:
      status === "paid"
        ? "Payment was received for this ad campaign."
        : "This ad campaign payment failed.",
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
    await insertNotifications(adPaymentNotifications);
    revalidatePath("/notifications");
  }

  for (const campaign of transitionedCampaigns ?? []) {
    const paid = status === "paid";
    const body = paid
      ? `Payment was received for your ad campaign: ${campaign.title}.`
      : `Payment failed for your ad campaign: ${campaign.title}.`;

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

async function markBookingCheckoutSession({
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

  const bookingId = session.metadata?.booking_request_id;
  if (!bookingId) {
    throw new Error("Missing booking request id on Stripe session.");
  }

  const now = new Date().toISOString();
  const platformFeeCents = metadataCents(session.metadata?.platform_fee_cents, 0);
  const depositAmountCents = metadataCents(
    session.metadata?.booking_deposit_cents,
    Math.max(0, (session.amount_total ?? 0) - platformFeeCents),
  );
  const updateValues = {
    payment_status: status === "cancelled" ? "payment_failed" : status,
    platform_fee_cents: platformFeeCents,
    deposit_amount_cents: depositAmountCents,
    status: status === "paid" ? "deposit_paid" : "accepted",
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    total_cents: session.amount_total ?? depositAmountCents + platformFeeCents,
    updated_at: now,
    ...(status === "paid" ? { paid_at: now } : {}),
  };

  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .update(updateValues)
    .eq("id", bookingId)
    .eq("stripe_checkout_session_id", session.id)
    .eq("payment_status", "checkout_started")
    .eq("status", "deposit_pending")
    .select("id, artist_id, client_id, title")
    .returns<BookingPaymentTransition[]>();

  if (error) {
    console.error("Webhook booking deposit status update failed.", error);
    throw new Error("Could not update booking deposit status.");
  }

  const notifications: NotificationInsert[] = [];

  for (const booking of bookings ?? []) {
    if (status === "paid") {
      notifications.push({
        actor_id: booking.client_id,
        body: "Booking deposit received.",
        href: "/account#booking-settings",
        recipient_id: booking.artist_id,
        subject_id: booking.id,
        subject_type: "booking_request",
        title: `Booking deposit paid: ${booking.title}`.slice(0, 120),
        type: "booking_deposit_paid",
      });
      continue;
    }

    notifications.push({
      actor_id: null,
      body:
        status === "cancelled"
          ? "Checkout expired or was cancelled, so this booking deposit was not completed."
          : "This booking deposit payment failed.",
      href: "/account#booking-settings",
      recipient_id: booking.client_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title:
        status === "cancelled"
          ? "Booking deposit checkout cancelled"
          : "Booking deposit payment failed",
      type: "booking_payment_failed",
    });
  }

  if (notifications.length) {
    await insertNotifications(notifications);
    revalidatePath("/notifications");
  }

  revalidatePath("/account");
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
    console.error("Webhook Merch refund status update failed.", error);
    throw new Error("Could not update merch refund status.");
  }

  await revalidateMerchOrderProducts(
    supabase,
    (refundedOrders ?? []).map((order) => order.id),
  );
  const refundNotifications = (refundedOrders ?? []).map((order) => ({
    actor_id: null,
    body: fullyRefunded
      ? "A full refund was recorded for this Merch order."
      : "A partial refund was recorded for this Merch order.",
    href: "/account#order-settings",
    recipient_id: order.buyer_id,
    subject_id: order.id,
    subject_type: "merch_order",
    title: fullyRefunded ? "Merch order refunded" : "Merch order partially refunded",
    type: "merch_refunded",
  }));

  if (refundNotifications.length) {
    await insertNotifications(refundNotifications);
  }

  for (const order of refundedOrders ?? []) {
    const body = fullyRefunded
      ? "A full refund was recorded for your Merch order."
      : "A partial refund was recorded for your Merch order.";

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
    console.error("Webhook ad refund status update failed.", adError);
    throw new Error("Could not update ad refund status.");
  }

  const adRefundNotifications = (refundedAds ?? []).map((campaign) => ({
    actor_id: null,
    body: "A full refund was recorded for this ad payment.",
    href: "/account#advertising-settings",
    recipient_id: campaign.advertiser_id,
    subject_id: campaign.id,
    subject_type: "ad_campaign",
    title: `Ad payment refunded: ${campaign.title}`.slice(0, 120),
    type: "ad_refunded",
  }));

  if (adRefundNotifications.length) {
    await insertNotifications(adRefundNotifications);
  }

  for (const campaign of refundedAds ?? []) {
    await maybeSendPaymentEmail({
      headerKind: "ad-refunded-advertiser",
      htmlBody: `A full refund was recorded for your ad payment: ${campaign.title}.`,
      subject: `${siteName} ad payment refunded`,
      supabase,
      textBody: `A full refund was recorded for your ad payment: ${campaign.title}.`,
      userId: campaign.advertiser_id,
    });
  }

  const { data: refundedBookings, error: bookingError } = await supabase
    .from("booking_requests")
    .update({
      payment_status: "refunded",
      status: "accepted",
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("payment_status", "paid")
    .select("id, artist_id, client_id, title")
    .returns<RefundedBookingTransition[]>();

  if (bookingError) {
    console.error("Webhook booking refund status update failed.", bookingError);
    throw new Error("Could not update booking refund status.");
  }

  const bookingRefundNotifications = (refundedBookings ?? []).flatMap((booking) => [
    {
      actor_id: null,
      body: "A full refund was recorded for this booking deposit.",
      href: "/account#booking-settings",
      recipient_id: booking.client_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title: `Booking deposit refunded: ${booking.title}`.slice(0, 120),
      type: "booking_refunded",
    },
    {
      actor_id: null,
      body: "A full refund was recorded for this booking deposit.",
      href: "/account#booking-settings",
      recipient_id: booking.artist_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title: `Booking deposit refunded: ${booking.title}`.slice(0, 120),
      type: "booking_refunded",
    },
  ]);

  if (bookingRefundNotifications.length) {
    await insertNotifications(bookingRefundNotifications);
  }

  for (const booking of refundedBookings ?? []) {
    await maybeSendPaymentEmail({
      headerKind: "booking-refunded-client",
      htmlBody: `A full refund was recorded for your booking deposit: ${booking.title}.`,
      subject: `${siteName} booking deposit refunded`,
      supabase,
      textBody: `A full refund was recorded for your booking deposit: ${booking.title}.`,
      userId: booking.client_id,
    });
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/ads");
  revalidatePath("/admin/merch");
  revalidatePath("/notifications");
}

async function recordRefundProblem({
  failureReason,
  paymentIntentId,
  refundId,
  status,
}: {
  failureReason: string | null;
  paymentIntentId: string;
  refundId: string;
  status: string | null;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const [merchResult, adResult, bookingResult] = await Promise.all([
    supabase
      .from("merch_orders")
      .select("id, status")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .returns<RefundProblemMerch[]>(),
    supabase
      .from("ad_campaigns")
      .select("id, title, status, payment_status")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .returns<RefundProblemAd[]>(),
    supabase
      .from("booking_requests")
      .select("id, title, status, payment_status")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .returns<RefundProblemBooking[]>(),
  ]);
  const firstError =
    merchResult.error ?? adResult.error ?? bookingResult.error;

  if (firstError) {
    console.error("Webhook refund problem lookup failed.", firstError);
    throw new Error("Could not inspect failed refund status.");
  }

  const sharedMetadata = {
    failure_reason: failureReason,
    payment_intent_id: paymentIntentId,
    refund_id: refundId,
    refund_status: status,
  };
  const auditLogs = [
    ...(merchResult.data ?? []).map((order) => ({
      actor_id: null,
      event_type: "merch_refund_problem",
      metadata: {
        ...sharedMetadata,
        merch_order_status: order.status,
      },
      summary: `Merch refund needs review: order ${order.id}`.slice(0, 180),
      target_id: order.id,
      target_type: "merch_order",
    })),
    ...(adResult.data ?? []).map((campaign) => ({
      actor_id: null,
      event_type: "ad_refund_problem",
      metadata: {
        ...sharedMetadata,
        ad_payment_status: campaign.payment_status,
        ad_status: campaign.status,
      },
      summary: `Ad refund needs review: ${campaign.title}`.slice(0, 180),
      target_id: campaign.id,
      target_type: "ad_campaign",
    })),
    ...(bookingResult.data ?? []).map((booking) => ({
      actor_id: null,
      event_type: "booking_refund_problem",
      metadata: {
        ...sharedMetadata,
        booking_payment_status: booking.payment_status,
        booking_status: booking.status,
      },
      summary: `Booking refund needs review: ${booking.title}`.slice(0, 180),
      target_id: booking.id,
      target_type: "booking_request",
    })),
  ];

  if (auditLogs.length) {
    const { error: auditError } = await supabase
      .from("admin_audit_logs")
      .insert(auditLogs);

    if (auditError) {
      console.error("Webhook refund problem audit record failed.", auditError);
      throw new Error("Could not record failed refund review.");
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
}

function disputeChargeId(dispute: Stripe.Dispute) {
  const charge = dispute.charge;

  if (typeof charge === "string") return charge;
  return charge?.id ?? null;
}

async function disputePaymentIntentId(dispute: Stripe.Dispute, stripe: Stripe) {
  const paymentIntent = (
    dispute as Stripe.Dispute & {
      payment_intent?: string | Stripe.PaymentIntent | null;
    }
  ).payment_intent;

  if (typeof paymentIntent === "string") return paymentIntent;

  const chargeId = disputeChargeId(dispute);
  if (!chargeId) return null;

  const charge = await stripe.charges.retrieve(chargeId);

  return typeof charge.payment_intent === "string" ? charge.payment_intent : null;
}

function disputeAuditEventType(targetType: string) {
  if (targetType === "ad_campaign") return "ad_payment_dispute";
  if (targetType === "booking_request") return "booking_payment_dispute";

  return "merch_payment_dispute";
}

function disputeAuditSummary({
  eventType,
  label,
  status,
}: {
  eventType: string;
  label: string;
  status: string | null;
}) {
  const suffix = status ? ` (${status})` : "";

  if (eventType === "charge.dispute.created") {
    return `Payment dispute opened${suffix}: ${label}`.slice(0, 180);
  }
  if (eventType === "charge.dispute.closed") {
    return `Payment dispute closed${suffix}: ${label}`.slice(0, 180);
  }
  if (eventType === "charge.dispute.funds_withdrawn") {
    return `Dispute funds withdrawn${suffix}: ${label}`.slice(0, 180);
  }
  if (eventType === "charge.dispute.funds_reinstated") {
    return `Dispute funds reinstated${suffix}: ${label}`.slice(0, 180);
  }

  return `Payment dispute updated${suffix}: ${label}`.slice(0, 180);
}

async function recordPaymentDispute({
  dispute,
  eventType,
  stripe,
}: {
  dispute: Stripe.Dispute;
  eventType: string;
  stripe: Stripe;
}) {
  const paymentIntentId = await disputePaymentIntentId(dispute, stripe);

  if (!paymentIntentId) return;

  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const paymentDisputeHold =
    eventType !== "charge.dispute.funds_reinstated" &&
    dispute.status !== "won" &&
    dispute.status !== "warning_closed";
  const disputeUpdate = {
    payment_dispute_hold: paymentDisputeHold,
    payment_dispute_status: dispute.status,
    payment_dispute_updated_at: new Date().toISOString(),
  };

  const [merchResult, adResult, bookingResult] = await Promise.all([
    supabase
      .from("merch_orders")
      .update(disputeUpdate)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .select("id")
      .returns<DisputedMerchPayment[]>(),
    supabase
      .from("ad_campaigns")
      .update(disputeUpdate)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .select("id, title")
      .returns<DisputedAdPayment[]>(),
    supabase
      .from("booking_requests")
      .update(disputeUpdate)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .select("id, title")
      .returns<DisputedBookingPayment[]>(),
  ]);

  const firstError = merchResult.error ?? adResult.error ?? bookingResult.error;

  if (firstError) {
    console.error("Webhook disputed payment hold update failed.", firstError);
    throw new Error("Could not update disputed payment safeguards.");
  }

  const sharedMetadata = {
    dispute_amount: dispute.amount,
    dispute_currency: dispute.currency,
    dispute_id: dispute.id,
    dispute_reason: dispute.reason,
    dispute_status: dispute.status,
    operational_hold: paymentDisputeHold,
    stripe_charge_id: disputeChargeId(dispute),
    payment_intent_id: paymentIntentId,
    stripe_event_type: eventType,
  };
  const auditLogs = [
    ...(merchResult.data ?? []).map((order) => ({
      actor_id: null,
      event_type: disputeAuditEventType("merch_order"),
      metadata: sharedMetadata,
      summary: disputeAuditSummary({
        eventType,
        label: `Merch order ${order.id}`,
        status: dispute.status,
      }),
      target_id: order.id,
      target_type: "merch_order",
    })),
    ...(adResult.data ?? []).map((campaign) => ({
      actor_id: null,
      event_type: disputeAuditEventType("ad_campaign"),
      metadata: sharedMetadata,
      summary: disputeAuditSummary({
        eventType,
        label: campaign.title,
        status: dispute.status,
      }),
      target_id: campaign.id,
      target_type: "ad_campaign",
    })),
    ...(bookingResult.data ?? []).map((booking) => ({
      actor_id: null,
      event_type: disputeAuditEventType("booking_request"),
      metadata: sharedMetadata,
      summary: disputeAuditSummary({
        eventType,
        label: booking.title,
        status: dispute.status,
      }),
      target_id: booking.id,
      target_type: "booking_request",
    })),
  ];

  if (auditLogs.length) {
    const { error: auditError } = await supabase
      .from("admin_audit_logs")
      .insert(auditLogs);

    if (auditError) {
      console.error("Webhook payment dispute audit record failed.", auditError);
      throw new Error("Could not record disputed payment.");
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/ads");
  revalidatePath("/admin/merch");
  revalidatePath("/");
  revalidatePath("/merch");
  revalidatePath("/account");
  revalidatePath("/messages");
}

export async function POST(request: Request) {
  const stripe = createStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return stripeResponse("Payment updates are not configured.", 500);
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return stripeResponse("Missing payment verification.", 400);
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
    console.error("Payment update verification failed.", error);
    return stripeResponse("Invalid payment update.", 400);
  }

  if (!stripeLivemodeMatches(event)) {
    console.warn("Payment update ignored because livemode did not match.", {
      eventType: event.type,
      livemode: event.livemode,
    });
    return stripeResponse("Payment update mode ignored.");
  }

  const supabase = createAdminClient();

  if (!supabase) {
    console.error("Payment update processing is not configured.");
    return stripeResponse("Could not process payment update.", 500);
  }

  const { data: claimStatus, error: claimError } = await supabase.rpc(
    "claim_stripe_webhook_event",
    {
      p_event_id: event.id,
      p_event_type: event.type,
    },
  );

  if (claimError) {
    console.error("Webhook event claim failed.", claimError);
    return stripeResponse("Could not process payment update.", 500);
  }

  if (claimStatus === "processed") {
    return stripeResponse("Stripe event already processed.");
  }

  if (claimStatus === "processing") {
    return stripeResponse("Payment update is already processing.", 500);
  }

  if (claimStatus !== "claimed") {
    console.error("Webhook event claim returned an invalid status.");
    return stripeResponse("Could not process payment update.", 500);
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      if (checkoutSessionIsSettled(event, session)) {
        if (session.metadata?.payment_kind === "ad_campaign") {
          await markAdCheckoutSession({ session, status: "paid" });
        } else if (session.metadata?.payment_kind === "booking_deposit") {
          await markBookingCheckoutSession({ session, status: "paid" });
        } else if (isMerchCheckoutSession(session)) {
          await markCheckoutSession({
            session,
            status: "paid",
          });
        } else {
          throw new Error("Unknown checkout session payment type.");
        }
      } else {
        console.warn("Checkout session completed before payment settled.", {
          paymentStatus: session.payment_status,
          sessionId: session.id,
        });
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.payment_kind === "ad_campaign") {
        await markAdCheckoutSession({ session, status: "payment_failed" });
      } else if (session.metadata?.payment_kind === "booking_deposit") {
        await markBookingCheckoutSession({ session, status: "payment_failed" });
      } else if (isMerchCheckoutSession(session)) {
        await markCheckoutSession({
          session,
          status: "payment_failed",
        });
      } else {
        throw new Error("Unknown checkout session payment type.");
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.payment_kind === "ad_campaign") {
        await markAdCheckoutSession({ session, status: "payment_failed" });
      } else if (session.metadata?.payment_kind === "booking_deposit") {
        await markBookingCheckoutSession({ session, status: "cancelled" });
      } else if (isMerchCheckoutSession(session)) {
        await markCheckoutSession({
          session,
          status: "cancelled",
        });
      } else {
        throw new Error("Unknown checkout session payment type.");
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

    if (event.type === "refund.failed") {
      const refund = event.data.object as Stripe.Refund;
      const paymentIntentId =
        typeof refund.payment_intent === "string" ? refund.payment_intent : null;

      if (paymentIntentId) {
        await recordRefundProblem({
          failureReason: refund.failure_reason ?? null,
          paymentIntentId,
          refundId: refund.id,
          status: refund.status,
        });
      }
    }

    if (
      disputeWebhookEvents.includes(
        event.type as (typeof disputeWebhookEvents)[number],
      )
    ) {
      const dispute = event.data.object as Stripe.Dispute;
      await recordPaymentDispute({ dispute, eventType: event.type, stripe });
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await syncStripeConnectAccountFromWebhook(supabase, account, event.livemode);
    }

    const { data: completed, error: completionError } = await supabase.rpc(
      "complete_stripe_webhook_event",
      { p_event_id: event.id },
    );

    if (completionError || completed !== true) {
      console.error("Webhook event completion failed.", completionError);
      throw new Error("Could not complete payment update processing.");
    }
  } catch (error) {
    console.error("Payment update processing failed.", error);

    const { error: failureError } = await supabase.rpc(
      "fail_stripe_webhook_event",
      {
        p_error: "Payment update processing failed.",
        p_event_id: event.id,
      },
    );

    if (failureError) {
      console.error("Webhook event failure status could not be saved.", failureError);
    }

    return stripeResponse("Could not process payment update.", 500);
  }

  return stripeResponse("ok");
}
