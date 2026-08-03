import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import {
  grantVerifiedAdCreditPurchase,
  reconcileVerifiedAdCreditPurchase,
  type AdCreditReconciliationInput,
  type AdPurchaseRpcClient,
} from "@/lib/ads/purchase-grant";
import {
  stripeAdCreditDisputeReconciliation,
  stripeAdCreditGrantFromCheckout,
  stripeAdCreditRefundFromCharge,
} from "@/lib/ads/stripe-credit";
import { sendHostgatorEmail } from "@/lib/mail/hostgator";
import { insertNotifications } from "@/lib/notification-write";
import { calculatePlatformFeeCents } from "@/lib/payments/fees";
import { siteName, siteUrl, supportEmail } from "@/lib/site";
import {
  createStripeClient,
  expectedStripeLivemode,
  stripeSecretKeyLivemode,
  stripeCryptoProvider,
  stripeWebhookSigningSecretConfigured,
} from "@/lib/stripe/server";
import { stripeConnectStatus } from "@/lib/stripe/connect";
import { bookingPaidTransitionDecision } from "@/lib/stripe/checkout-session";
import { bookingRefundAmountProgress } from "@/lib/stripe/booking-refund";
import {
  stripeWebhookAccountScope,
  type StripeWebhookSource,
} from "@/lib/stripe/webhook-account";
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

async function verifyStripeWebhookEvent({
  body,
  signature,
  stripe,
}: {
  body: string;
  signature: string;
  stripe: Stripe;
}) {
  const candidates: Array<{
    secret: string;
    source: StripeWebhookSource;
  }> = [];
  const platformSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (stripeWebhookSigningSecretConfigured(platformSecret)) {
    candidates.push({ secret: platformSecret!, source: "platform" });
  }
  if (stripeWebhookSigningSecretConfigured(connectSecret)) {
    candidates.push({ secret: connectSecret!, source: "connect" });
  }

  for (const candidate of candidates) {
    try {
      const event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        candidate.secret,
        undefined,
        stripeCryptoProvider,
      );

      return { event, source: candidate.source };
    } catch {
      // Try the other configured destination secret before rejecting.
    }
  }

  return null;
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
const stripeApplicationFeePattern = /^fee_[A-Za-z0-9]{8,200}$/;

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
    console.warn("Ignoring Stripe Connect account update for unknown account.");
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

async function recordBookingApplicationFee({
  applicationFee,
  stripe,
}: {
  applicationFee: Stripe.ApplicationFee;
  stripe: Stripe;
}) {
  const connectedAccountId =
    typeof applicationFee.account === "string"
      ? applicationFee.account
      : applicationFee.account.id;
  const validAccountScope = stripeWebhookAccountScope({
    eventAccount: connectedAccountId,
    source: "connect",
  });
  const chargeId =
    typeof applicationFee.charge === "string"
      ? applicationFee.charge
      : applicationFee.charge.id;

  if (
    !validAccountScope ||
    !chargeId ||
    !stripeApplicationFeePattern.test(applicationFee.id) ||
    applicationFee.currency.toLowerCase() !== "usd" ||
    !Number.isInteger(applicationFee.amount) ||
    !Number.isInteger(applicationFee.amount_refunded) ||
    applicationFee.amount <= 0 ||
    applicationFee.amount_refunded < 0 ||
    applicationFee.amount_refunded > applicationFee.amount
  ) {
    throw new Error("Application fee account context was invalid.");
  }

  const charge = await stripe.charges.retrieve(
    chargeId,
    {},
    { stripeAccount: connectedAccountId },
  );
  const bookingId = charge.metadata?.booking_request_id;
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;

  if (
    !bookingId ||
    !paymentIntentId ||
    charge.metadata?.payment_kind !== "booking_deposit" ||
    charge.metadata?.payment_charge_model !== "connected_direct" ||
    charge.metadata?.fee_payer !== "provider"
  ) {
    throw new Error("Application fee booking context was missing.");
  }

  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const { data: booking, error: bookingError } = await supabase
    .from("booking_requests")
    .select(
      "id, platform_fee_cents, refunded_platform_fee_cents, stripe_application_fee_id, total_cents",
    )
    .eq("id", bookingId)
    .eq("stripe_connected_account_id", connectedAccountId)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("payment_charge_model", "connected_direct")
    .eq("fee_payer", "provider")
    .maybeSingle<{
      id: string;
      platform_fee_cents: number;
      refunded_platform_fee_cents: number;
      stripe_application_fee_id: string | null;
      total_cents: number;
    }>();

  if (
    bookingError ||
    !booking ||
    booking.platform_fee_cents !== applicationFee.amount ||
    booking.total_cents !== charge.amount ||
    (booking.stripe_application_fee_id !== null &&
      booking.stripe_application_fee_id !== applicationFee.id)
  ) {
    console.error("Webhook booking application fee lookup failed.");
    throw new Error("Could not match booking application fee.");
  }

  const refundProgress = bookingRefundAmountProgress({
    currentAmount: booking.refunded_platform_fee_cents,
    incomingAmount: applicationFee.amount_refunded,
    totalAmount: applicationFee.amount,
  });

  if (!refundProgress) {
    throw new Error("Application fee refund progress was invalid.");
  }

  if (refundProgress === "stale") {
    if (booking.stripe_application_fee_id !== applicationFee.id) {
      throw new Error("Stale application fee identity did not match.");
    }

    return;
  }

  if (
    refundProgress === "current" &&
    booking.stripe_application_fee_id === applicationFee.id
  ) {
    return;
  }

  let updateQuery = supabase
    .from("booking_requests")
    .update({
      refunded_platform_fee_cents: applicationFee.amount_refunded,
      stripe_application_fee_id: applicationFee.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("stripe_connected_account_id", connectedAccountId)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq(
      "refunded_platform_fee_cents",
      booking.refunded_platform_fee_cents,
    );

  updateQuery = booking.stripe_application_fee_id
    ? updateQuery.eq("stripe_application_fee_id", applicationFee.id)
    : updateQuery.is("stripe_application_fee_id", null);

  const { data: updated, error } = await updateQuery
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("Webhook booking application fee update failed.");
    throw new Error("Could not record booking application fee.");
  }

  if (!updated) {
    const { data: latest, error: latestError } = await supabase
      .from("booking_requests")
      .select(
        "id, platform_fee_cents, refunded_platform_fee_cents, stripe_application_fee_id",
      )
      .eq("id", booking.id)
      .eq("stripe_connected_account_id", connectedAccountId)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("payment_charge_model", "connected_direct")
      .eq("fee_payer", "provider")
      .maybeSingle<{
        id: string;
        platform_fee_cents: number;
        refunded_platform_fee_cents: number;
        stripe_application_fee_id: string | null;
      }>();
    const latestProgress = latest
      ? bookingRefundAmountProgress({
          currentAmount: latest.refunded_platform_fee_cents,
          incomingAmount: applicationFee.amount_refunded,
          totalAmount: applicationFee.amount,
        })
      : null;

    if (
      latestError ||
      !latest ||
      latest.platform_fee_cents !== applicationFee.amount ||
      latest.stripe_application_fee_id !== applicationFee.id ||
      !latestProgress ||
      latestProgress === "advance"
    ) {
      console.error("Webhook booking application fee race check failed.");
      throw new Error("Could not confirm booking application fee.");
    }
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");
}

async function recordLatestBookingApplicationFee({
  applicationFeeId,
  stripe,
}: {
  applicationFeeId: string;
  stripe: Stripe;
}) {
  if (!stripeApplicationFeePattern.test(applicationFeeId)) {
    throw new Error("Application fee identity was invalid.");
  }

  const applicationFee = await stripe.applicationFees.retrieve(applicationFeeId);
  if (applicationFee.id !== applicationFeeId) {
    throw new Error("Application fee retrieval did not match.");
  }

  await recordBookingApplicationFee({ applicationFee, stripe });
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

async function grantStripeAdCreditPurchase(session: Stripe.Checkout.Session) {
  const purchase = stripeAdCreditGrantFromCheckout(session);
  if (!purchase) {
    throw new Error("Stripe ad credit purchase identity did not match.");
  }

  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const grant = await grantVerifiedAdCreditPurchase(
    supabase as unknown as AdPurchaseRpcClient,
    purchase,
  );
  if (!grant.ok) {
    console.error("Webhook Stripe ad credit grant failed.");
    throw new Error("Could not record Stripe ad credit purchase.");
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");
}

async function reconcileStripeAdCreditPurchaseIfPresent({
  eventId,
  reconciliation,
}: {
  eventId: string;
  reconciliation: Omit<AdCreditReconciliationInput, "providerEventId"> | null;
}) {
  if (!reconciliation) return false;
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const result = await reconcileVerifiedAdCreditPurchase(
    supabase as unknown as AdPurchaseRpcClient,
    {
      ...reconciliation,
      providerEventId: eventId,
    },
  );
  if (!result.ok) {
    console.error("Webhook Stripe ad credit reconciliation failed.");
    throw new Error("Could not reconcile Stripe ad credit purchase.");
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");
  return true;
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
  connectedAccountId,
  session,
  status,
}: {
  connectedAccountId: string;
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
    connectedAccountId === "platform"
      ? Math.max(0, (session.amount_total ?? 0) - platformFeeCents)
      : session.amount_total ?? 0,
  );
  const connectedDirect = connectedAccountId !== "platform";

  if (
    status !== "paid" &&
    (session.payment_status !== "unpaid" ||
      !["complete", "expired"].includes(session.status ?? ""))
  ) {
    throw new Error("Unpaid booking checkout was not safely closed.");
  }

  if (
    connectedDirect &&
    (session.metadata?.fee_payer !== "provider" ||
      session.metadata?.payment_charge_model !== "connected_direct" ||
      session.amount_total !== depositAmountCents ||
      platformFeeCents !== calculatePlatformFeeCents(depositAmountCents))
  ) {
    throw new Error("Connected booking checkout identity did not match.");
  }

  const updateValues = {
    payment_status: status === "cancelled" ? "payment_failed" : status,
    platform_fee_cents: platformFeeCents,
    deposit_amount_cents: depositAmountCents,
    status: status === "paid" ? "deposit_paid" : "accepted",
    stripe_checkout_session_id: status === "paid" ? session.id : null,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    total_cents: connectedDirect
      ? depositAmountCents
      : session.amount_total ?? depositAmountCents + platformFeeCents,
    updated_at: now,
    ...(connectedDirect && status !== "paid"
      ? { stripe_connected_account_id: null }
      : {}),
    ...(status === "paid" ? { paid_at: now } : {}),
  };

  let bookingUpdate = supabase
    .from("booking_requests")
    .update(updateValues)
    .eq("id", bookingId)
    .eq("stripe_checkout_session_id", session.id)
    .eq("payment_status", "checkout_started")
    .eq("status", "deposit_pending");

  bookingUpdate = connectedDirect
    ? bookingUpdate
        .eq("stripe_connected_account_id", connectedAccountId)
        .eq("fee_payer", "provider")
        .eq("payment_charge_model", "connected_direct")
    : bookingUpdate
        .is("stripe_connected_account_id", null)
        .eq("fee_payer", "client")
        .eq("payment_charge_model", "platform");

  const { data: bookings, error } = await bookingUpdate
    .select("id, artist_id, client_id, title")
    .returns<BookingPaymentTransition[]>();

  if (error) {
    console.error("Webhook booking deposit status update failed.", error);
    throw new Error("Could not update booking deposit status.");
  }

  const transitionedBookings = bookings ?? [];

  if (status === "paid" && transitionedBookings.length === 0) {
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    let existingPaidBooking: { id: string } | null = null;
    let existingPaidBookingError: unknown = null;

    if (paymentIntentId) {
      let paidLookup = supabase
        .from("booking_requests")
        .select("id")
        .eq("id", bookingId)
        .eq("stripe_checkout_session_id", session.id)
        .eq("stripe_payment_intent_id", paymentIntentId)
        .eq("payment_status", "paid")
        .eq("status", "deposit_paid");

      paidLookup = connectedDirect
        ? paidLookup.eq("stripe_connected_account_id", connectedAccountId)
        : paidLookup.is("stripe_connected_account_id", null);

      const { data, error } = await paidLookup
        .maybeSingle<{ id: string }>();

      existingPaidBooking = data;
      existingPaidBookingError = error;
    }

    const paidTransitionDecision = bookingPaidTransitionDecision({
      bookingId,
      existingPaidBookingId: existingPaidBooking?.id ?? null,
      lookupError: Boolean(existingPaidBookingError),
      paymentIntentId,
      transitionedCount: transitionedBookings.length,
    });

    if (paidTransitionDecision.action === "retry") {
      if (existingPaidBookingError) {
        console.error(
          "Webhook paid booking idempotency lookup failed.",
          existingPaidBookingError,
        );
      } else {
        console.error(
          "Webhook paid booking transition matched no held or already-paid booking.",
        );
      }

      throw new Error("Could not confirm booking deposit paid transition.");
    }
  }

  const notifications: NotificationInsert[] = [];

  for (const booking of transitionedBookings) {
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

async function markConnectedBookingRefunded({
  charge,
  connectedAccountId,
  stripe,
}: {
  charge: Stripe.Charge;
  connectedAccountId: string;
  stripe: Stripe;
}) {
  if (charge.metadata?.payment_kind !== "booking_deposit") return;

  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  const applicationFeeId =
    typeof charge.application_fee === "string"
      ? charge.application_fee
      : charge.application_fee?.id;
  const fullyRefunded = charge.amount_refunded >= charge.amount;

  if (
    !paymentIntentId ||
    !applicationFeeId ||
    !stripeApplicationFeePattern.test(applicationFeeId) ||
    charge.metadata?.payment_charge_model !== "connected_direct" ||
    charge.metadata?.fee_payer !== "provider" ||
    charge.currency.toLowerCase() !== "usd" ||
    !Number.isInteger(charge.amount) ||
    !Number.isInteger(charge.amount_refunded) ||
    charge.amount <= 0 ||
    charge.amount_refunded <= 0 ||
    charge.amount_refunded > charge.amount
  ) {
    throw new Error("Connected booking refund context was invalid.");
  }

  await recordLatestBookingApplicationFee({ applicationFeeId, stripe });

  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const now = new Date().toISOString();
  const { data: refundedBookings, error } = await supabase
    .from("booking_requests")
    .update({
      payment_status: fullyRefunded ? "refunded" : "partially_refunded",
      refunded_amount_cents: charge.amount_refunded,
      status: fullyRefunded ? "accepted" : "deposit_paid",
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("stripe_connected_account_id", connectedAccountId)
    .eq("stripe_application_fee_id", applicationFeeId)
    .eq("payment_charge_model", "connected_direct")
    .eq("fee_payer", "provider")
    .eq("total_cents", charge.amount)
    .in("payment_status", ["paid", "partially_refunded"])
    .lt("refunded_amount_cents", charge.amount_refunded)
    .select("id, artist_id, client_id, title")
    .returns<RefundedBookingTransition[]>();

  if (error) {
    console.error("Webhook connected booking refund status update failed.");
    throw new Error("Could not update connected booking refund status.");
  }

  if (!refundedBookings?.length) {
    const { data: existing, error: existingError } = await supabase
      .from("booking_requests")
      .select("id, payment_status, refunded_amount_cents, total_cents")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("stripe_connected_account_id", connectedAccountId)
      .eq("stripe_application_fee_id", applicationFeeId)
      .eq("payment_charge_model", "connected_direct")
      .eq("fee_payer", "provider")
      .eq("total_cents", charge.amount)
      .maybeSingle<{
        id: string;
        payment_status: string;
        refunded_amount_cents: number;
        total_cents: number;
      }>();

    const existingProgress = existing
      ? bookingRefundAmountProgress({
          currentAmount: existing.refunded_amount_cents,
          incomingAmount: charge.amount_refunded,
          totalAmount: charge.amount,
        })
      : null;
    const existingStatusMatches = existing
      ? existing.refunded_amount_cents === existing.total_cents
        ? existing.payment_status === "refunded"
        : existing.refunded_amount_cents > 0 &&
          existing.payment_status === "partially_refunded"
      : false;

    if (
      existingError ||
      !existing ||
      !existingProgress ||
      existingProgress === "advance" ||
      !existingStatusMatches
    ) {
      console.error("Webhook connected booking refund idempotency check failed.");
      throw new Error("Could not confirm connected booking refund status.");
    }

    return;
  }

  const body = fullyRefunded
    ? "A full refund was recorded for this booking deposit."
    : "A partial refund was recorded for this booking deposit.";
  const titlePrefix = fullyRefunded
    ? "Booking deposit refunded"
    : "Booking deposit partially refunded";
  const notifications = refundedBookings.flatMap((booking) => [
    {
      actor_id: null,
      body,
      href: "/account#booking-settings",
      recipient_id: booking.client_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title: `${titlePrefix}: ${booking.title}`.slice(0, 120),
      type: fullyRefunded ? "booking_refunded" : "booking_partially_refunded",
    },
    {
      actor_id: null,
      body,
      href: "/account#booking-settings",
      recipient_id: booking.artist_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title: `${titlePrefix}: ${booking.title}`.slice(0, 120),
      type: fullyRefunded ? "booking_refunded" : "booking_partially_refunded",
    },
  ]);

  await insertNotifications(notifications);

  for (const booking of refundedBookings) {
    await maybeSendPaymentEmail({
      headerKind: fullyRefunded
        ? "booking-refunded-client"
        : "booking-partially-refunded-client",
      htmlBody: `${body.slice(0, -1)}: ${booking.title}.`,
      subject: fullyRefunded
        ? `${siteName} booking deposit refunded`
        : `${siteName} booking deposit partially refunded`,
      supabase,
      textBody: `${body.slice(0, -1)}: ${booking.title}.`,
      userId: booking.client_id,
    });
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");
  revalidatePath("/messages");
  revalidatePath("/notifications");
}

async function markRefunded({
  accountScope,
  charge,
  eventId,
  stripe,
}: {
  accountScope: string;
  charge: Stripe.Charge;
  eventId: string;
  stripe: Stripe;
}) {
  if (accountScope !== "platform") {
    await markConnectedBookingRefunded({
      charge,
      connectedAccountId: accountScope,
      stripe,
    });
    return;
  }

  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const adCreditRefund = stripeAdCreditRefundFromCharge(charge);
  const fullyRefunded = charge.amount_refunded === charge.amount;
  const refundShapeValid =
    charge.currency === "usd" &&
    Number.isSafeInteger(charge.amount) &&
    charge.amount > 0 &&
    Number.isSafeInteger(charge.amount_refunded) &&
    charge.amount_refunded > 0 &&
    charge.amount_refunded <= charge.amount &&
    charge.refunded === fullyRefunded &&
    (charge.metadata?.payment_kind !== "ad_credit_purchase" ||
      (adCreditRefund !== null &&
        adCreditRefund.providerTransactionId === paymentIntentId));
  if (
    charge.metadata?.payment_kind === "ad_credit_purchase" &&
    !refundShapeValid
  ) {
    throw new Error("Stripe ad credit refund identity did not match.");
  }
  const adCreditReconciled = await reconcileStripeAdCreditPurchaseIfPresent({
    eventId,
    reconciliation: adCreditRefund,
  });

  if (adCreditReconciled) return;

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
      refunded_amount_cents: charge.amount_refunded,
      status: "accepted",
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("total_cents", charge.amount)
    .eq("payment_charge_model", "platform")
    .is("stripe_connected_account_id", null)
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
  accountScope,
  failureReason,
  paymentIntentId,
  refundId,
  status,
}: {
  accountScope: string;
  failureReason: string | null;
  paymentIntentId: string;
  refundId: string;
  status: string | null;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  let merchRows: RefundProblemMerch[] = [];
  let adRows: RefundProblemAd[] = [];
  let bookingRows: RefundProblemBooking[] = [];
  let firstError: unknown = null;

  if (accountScope === "platform") {
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
        .eq("payment_charge_model", "platform")
        .is("stripe_connected_account_id", null)
        .returns<RefundProblemBooking[]>(),
    ]);
    merchRows = merchResult.data ?? [];
    adRows = adResult.data ?? [];
    bookingRows = bookingResult.data ?? [];
    firstError = merchResult.error ?? adResult.error ?? bookingResult.error;
  } else {
    const bookingResult = await supabase
      .from("booking_requests")
      .select("id, title, status, payment_status")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("stripe_connected_account_id", accountScope)
      .eq("payment_charge_model", "connected_direct")
      .eq("fee_payer", "provider")
      .returns<RefundProblemBooking[]>();
    bookingRows = bookingResult.data ?? [];
    firstError = bookingResult.error;
  }

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
    ...merchRows.map((order) => ({
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
    ...adRows.map((campaign) => ({
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
    ...bookingRows.map((booking) => ({
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

async function disputePaymentContext(
  dispute: Stripe.Dispute,
  stripe: Stripe,
  accountScope: string,
) {
  const paymentIntent = (
    dispute as Stripe.Dispute & {
      payment_intent?: string | Stripe.PaymentIntent | null;
    }
  ).payment_intent;

  const chargeReference = dispute.charge;
  const charge =
    typeof chargeReference === "string"
      ? await stripe.charges.retrieve(
          chargeReference,
          {},
          accountScope === "platform" ? {} : { stripeAccount: accountScope },
        )
      : chargeReference;
  const paymentIntentId =
    typeof paymentIntent === "string"
      ? paymentIntent
      : typeof charge?.payment_intent === "string"
        ? charge.payment_intent
        : null;

  return charge && paymentIntentId ? { charge, paymentIntentId } : null;
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
  accountScope,
  dispute,
  eventId,
  eventType,
  stripe,
}: {
  accountScope: string;
  dispute: Stripe.Dispute;
  eventId: string;
  eventType: string;
  stripe: Stripe;
}) {
  const paymentContext = await disputePaymentContext(
    dispute,
    stripe,
    accountScope,
  );

  if (!paymentContext) return;
  const { charge, paymentIntentId } = paymentContext;

  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase service role key for Stripe webhook.");
  }

  const paymentDisputeHold =
    eventType !== "charge.dispute.funds_reinstated" &&
    dispute.status !== "won" &&
    dispute.status !== "warning_closed" &&
    dispute.status !== "prevented";
  const disputeUpdate = {
    payment_dispute_hold: paymentDisputeHold,
    payment_dispute_status: dispute.status,
    payment_dispute_updated_at: new Date().toISOString(),
  };

  let merchRows: DisputedMerchPayment[] = [];
  let adRows: DisputedAdPayment[] = [];
  let bookingRows: DisputedBookingPayment[] = [];
  let firstError: unknown = null;

  if (accountScope === "platform") {
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
        .eq("payment_charge_model", "platform")
        .is("stripe_connected_account_id", null)
        .select("id, title")
        .returns<DisputedBookingPayment[]>(),
    ]);
    merchRows = merchResult.data ?? [];
    adRows = adResult.data ?? [];
    bookingRows = bookingResult.data ?? [];
    firstError = merchResult.error ?? adResult.error ?? bookingResult.error;
  } else {
    const bookingResult = await supabase
      .from("booking_requests")
      .update(disputeUpdate)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("stripe_connected_account_id", accountScope)
      .eq("payment_charge_model", "connected_direct")
      .eq("fee_payer", "provider")
      .select("id, title")
      .returns<DisputedBookingPayment[]>();
    bookingRows = bookingResult.data ?? [];
    firstError = bookingResult.error;
  }

  if (firstError) {
    console.error("Webhook disputed payment hold update failed.", firstError);
    throw new Error("Could not update disputed payment safeguards.");
  }

  if (accountScope === "platform") {
    const adCreditReconciliation = stripeAdCreditDisputeReconciliation(
      eventType,
      dispute,
      charge,
    );
    if (
      charge.metadata?.payment_kind === "ad_credit_purchase" &&
      !adCreditReconciliation
    ) {
      throw new Error("Stripe ad credit dispute identity did not match.");
    }
    await reconcileStripeAdCreditPurchaseIfPresent({
      eventId,
      reconciliation: adCreditReconciliation,
    });
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
    ...merchRows.map((order) => ({
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
    ...adRows.map((campaign) => ({
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
    ...bookingRows.map((booking) => ({
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
  const hasWebhookSecret =
    stripeWebhookSigningSecretConfigured(process.env.STRIPE_WEBHOOK_SECRET) ||
    stripeWebhookSigningSecretConfigured(
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    );

  if (!stripe || !hasWebhookSecret) {
    return stripeResponse("Payment updates are not configured.", 500);
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return stripeResponse("Missing payment verification.", 400);
  }

  const body = await request.text();
  const verifiedWebhook = await verifyStripeWebhookEvent({
    body,
    signature,
    stripe,
  });

  if (!verifiedWebhook) {
    console.error("Payment update verification failed.");
    return stripeResponse("Invalid payment update.", 400);
  }

  const { event } = verifiedWebhook;
  const accountScope = stripeWebhookAccountScope({
    eventAccount: event.account,
    source: verifiedWebhook.source,
  });

  if (!accountScope) {
    console.error("Payment update account scope did not match its destination.");
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
      p_account_scope: accountScope,
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
        if (session.metadata?.payment_kind === "ad_credit_purchase") {
          if (accountScope !== "platform") {
            throw new Error("Ad credit checkout arrived from a connected account.");
          }
          await grantStripeAdCreditPurchase(session);
        } else if (session.metadata?.payment_kind === "ad_campaign") {
          if (accountScope !== "platform") {
            throw new Error("Ad checkout arrived from a connected account.");
          }
          await markAdCheckoutSession({ session, status: "paid" });
        } else if (session.metadata?.payment_kind === "booking_deposit") {
          await markBookingCheckoutSession({
            connectedAccountId: accountScope,
            session,
            status: "paid",
          });
        } else if (isMerchCheckoutSession(session)) {
          if (accountScope !== "platform") {
            throw new Error("Merch checkout arrived from a connected account.");
          }
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

      if (session.metadata?.payment_kind === "ad_credit_purchase") {
        if (accountScope !== "platform") {
          throw new Error("Ad credit checkout arrived from a connected account.");
        }
      } else if (session.metadata?.payment_kind === "ad_campaign") {
        if (accountScope !== "platform") {
          throw new Error("Ad checkout arrived from a connected account.");
        }
        await markAdCheckoutSession({ session, status: "payment_failed" });
      } else if (session.metadata?.payment_kind === "booking_deposit") {
        await markBookingCheckoutSession({
          connectedAccountId: accountScope,
          session,
          status: "payment_failed",
        });
      } else if (isMerchCheckoutSession(session)) {
        if (accountScope !== "platform") {
          throw new Error("Merch checkout arrived from a connected account.");
        }
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

      if (session.metadata?.payment_kind === "ad_credit_purchase") {
        if (accountScope !== "platform") {
          throw new Error("Ad credit checkout arrived from a connected account.");
        }
      } else if (session.metadata?.payment_kind === "ad_campaign") {
        if (accountScope !== "platform") {
          throw new Error("Ad checkout arrived from a connected account.");
        }
        await markAdCheckoutSession({ session, status: "payment_failed" });
      } else if (session.metadata?.payment_kind === "booking_deposit") {
        await markBookingCheckoutSession({
          connectedAccountId: accountScope,
          session,
          status: "cancelled",
        });
      } else if (isMerchCheckoutSession(session)) {
        if (accountScope !== "platform") {
          throw new Error("Merch checkout arrived from a connected account.");
        }
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
      await markRefunded({ accountScope, charge, eventId: event.id, stripe });
    }

    if (event.type === "refund.failed") {
      const refund = event.data.object as Stripe.Refund;
      const paymentIntentId =
        typeof refund.payment_intent === "string" ? refund.payment_intent : null;

      if (paymentIntentId) {
        await recordRefundProblem({
          accountScope,
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
      await recordPaymentDispute({
        accountScope,
        dispute,
        eventId: event.id,
        eventType: event.type,
        stripe,
      });
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      if (accountScope !== "platform") {
        if (account.id !== accountScope) {
          throw new Error("Connected account update identity did not match.");
        }
        await syncStripeConnectAccountFromWebhook(supabase, account, event.livemode);
      }
    }

    if (event.type === "application_fee.created") {
      if (accountScope !== "platform") {
        throw new Error("Application fee update arrived from a connected account.");
      }
      const applicationFee = event.data.object as Stripe.ApplicationFee;
      await recordLatestBookingApplicationFee({
        applicationFeeId: applicationFee.id,
        stripe,
      });
    }

    if (event.type === "application_fee.refunded") {
      if (accountScope !== "platform") {
        throw new Error("Application fee refund arrived from a connected account.");
      }
      const applicationFee = event.data.object as Stripe.ApplicationFee;
      await recordLatestBookingApplicationFee({
        applicationFeeId: applicationFee.id,
        stripe,
      });
    }

    const { data: completed, error: completionError } = await supabase.rpc(
      "complete_stripe_webhook_event",
      { p_account_scope: accountScope, p_event_id: event.id },
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
        p_account_scope: accountScope,
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
