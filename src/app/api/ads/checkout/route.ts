import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  calculatePlatformFeeCents,
  platformFeeDescription,
} from "@/lib/payments/fees";
import { AD_PURCHASES_AVAILABLE } from "@/lib/commerce-launch";
import { siteName, siteUrl } from "@/lib/site";
import {
  createStripeCheckoutSession,
  expireCheckoutSessionBeforeRollback,
  StripeCheckoutRequestError,
  type StripeCheckoutSession,
} from "@/lib/stripe/checkout-session";
import { stripeCheckoutPreflight } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

type AdCampaign = {
  advertiser_id: string;
  campaign_type: string;
  daily_budget_cents: number;
  id: string;
  name: string;
  payment_status: string;
  platform_fee_cents: number | null;
  prepaid_amount_cents: number | null;
  status: string;
  stripe_checkout_session_id: string | null;
  title: string;
};

function safeInternalReturnPath(value: FormDataEntryValue | null) {
  const text = String(value ?? "")
    .trim()
    .slice(0, 240);

  if (!text || !text.startsWith("/") || text.startsWith("//") || text.includes("\\")) {
    return null;
  }

  return text;
}

function pathWithMessage(returnTo: string | null, message: string) {
  if (!returnTo) {
    return `/account?message=${encodeURIComponent(message)}#advertising-settings`;
  }

  const returnUrl = new URL(returnTo, siteUrl);
  returnUrl.searchParams.set("message", message);

  return `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
}

function redirectWithMessage(message: string, returnTo: string | null = null) {
  return NextResponse.redirect(
    `${siteUrl}${pathWithMessage(returnTo, message)}`,
    { status: 303 },
  );
}

async function createAdCheckoutSession({
  campaign,
  idempotencyKey,
  platformFeeCents,
  prepaidAmountCents,
  returnTo,
  secretKey,
}: {
  campaign: AdCampaign;
  idempotencyKey: string;
  platformFeeCents: number;
  prepaidAmountCents: number;
  returnTo: string | null;
  secretKey: string;
}) {
  const successUrl = `${siteUrl}${pathWithMessage(
    returnTo,
    "Ad payment received. Payment status will update soon.",
  )}`;
  const cancelUrl = `${siteUrl}${pathWithMessage(returnTo, "Ad payment canceled.")}`;
  const body = new URLSearchParams({
    "allow_promotion_codes": "false",
    "billing_address_collection": "auto",
    "client_reference_id": campaign.id,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][metadata][ad_campaign_id]":
      campaign.id,
    "line_items[0][price_data][product_data][name]": `${siteName} ad budget: ${campaign.name}`,
    "line_items[0][price_data][product_data][description]":
      campaign.title.slice(0, 500),
    "line_items[0][price_data][unit_amount]": String(prepaidAmountCents),
    "line_items[0][quantity]": "1",
    "metadata[ad_campaign_id]": campaign.id,
    "metadata[advertiser_id]": campaign.advertiser_id,
    "metadata[payment_kind]": "ad_campaign",
    "metadata[platform_fee_cents]": String(platformFeeCents),
    "metadata[prepaid_amount_cents]": String(prepaidAmountCents),
    "mode": "payment",
    "payment_intent_data[metadata][ad_campaign_id]": campaign.id,
    "payment_intent_data[metadata][advertiser_id]": campaign.advertiser_id,
    "payment_intent_data[metadata][payment_kind]": "ad_campaign",
    "payment_intent_data[metadata][platform_fee_cents]": String(platformFeeCents),
    "payment_intent_data[metadata][prepaid_amount_cents]":
      String(prepaidAmountCents),
    "submit_type": "pay",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
  });

  if (platformFeeCents > 0) {
    body.set("line_items[1][price_data][currency]", "usd");
    body.set("line_items[1][price_data][product_data][name]", `${siteName} platform fee`);
    body.set(
      "line_items[1][price_data][product_data][description]",
      platformFeeDescription("ad"),
    );
    body.set("line_items[1][price_data][unit_amount]", String(platformFeeCents));
    body.set("line_items[1][quantity]", "1");
  }

  return createStripeCheckoutSession({
    body,
    idempotencyKey,
    secretKey,
  });
}

export async function POST(request: Request) {
  if (!AD_PURCHASES_AVAILABLE) {
    return redirectWithMessage("Ad purchases are not available yet.");
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const canProcessStripeWebhooks = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!secretKey) {
    return redirectWithMessage(
      "Ad checkout is temporarily unavailable. Please try again later.",
    );
  }

  if (!canProcessStripeWebhooks) {
    return redirectWithMessage(
      "Ad checkout is temporarily unavailable. Please try again later.",
    );
  }

  const formData = await request.formData();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const returnTo = safeInternalReturnPath(formData.get("return_to"));

  if (!campaignId) {
    return redirectWithMessage("Choose an ad campaign first.", returnTo);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(
      `${siteUrl}/login?message=${encodeURIComponent("Sign in to pay for ads.")}&return_to=${encodeURIComponent(returnTo ?? "/account#advertising-settings")}`,
      { status: 303 },
    );
  }

  const checkoutPreflight = stripeCheckoutPreflight();
  if (!checkoutPreflight.ready) {
    console.error("Ad checkout mode preflight failed.", checkoutPreflight);
    return redirectWithMessage(
      "Ad checkout is temporarily unavailable. Please try again later.",
      returnTo,
    );
  }

  const { data: campaign, error } = await supabase
    .from("ad_campaigns")
    .select(
      "id, advertiser_id, name, title, campaign_type, status, payment_status, daily_budget_cents, platform_fee_cents, prepaid_amount_cents, stripe_checkout_session_id",
    )
    .eq("id", campaignId)
    .eq("advertiser_id", claims.sub)
    .maybeSingle<AdCampaign>();

  if (error || !campaign) {
    return redirectWithMessage("That ad campaign was not found.", returnTo);
  }

  if (!["pending_review", "approved", "paused"].includes(campaign.status)) {
    return redirectWithMessage(
      "Only pending, approved, or paused ads can start checkout.",
      returnTo,
    );
  }

  if (campaign.payment_status === "paid") {
    return redirectWithMessage("That ad campaign is already paid.", returnTo);
  }

  if (campaign.payment_status === "waived") {
    return redirectWithMessage(
      "That ad campaign payment has been waived.",
      returnTo,
    );
  }

  if (campaign.payment_status === "checkout_started") {
    return redirectWithMessage(
      "Ad checkout has already started. Finish that checkout or wait for it to expire before trying again.",
      returnTo,
    );
  }

  if (campaign.daily_budget_cents <= 0) {
    return redirectWithMessage(
      "Add a daily budget before starting ad checkout.",
      returnTo,
    );
  }

  const prepaidAmountCents = campaign.daily_budget_cents;
  const platformFeeCents = calculatePlatformFeeCents(prepaidAmountCents);
  const { data: creditApplied, error: creditError } = await supabase.rpc(
    "spend_ad_credit_for_campaign",
    { p_campaign_id: campaign.id },
  );

  if (creditError) {
    console.error("Ad credit check failed before checkout.", creditError);
    return redirectWithMessage(
      "Ad credit could not be checked for this campaign. Please try again.",
      returnTo,
    );
  }

  if (creditApplied) {
    revalidatePath("/account");
    revalidatePath("/admin");
    revalidatePath("/admin/ads");

    return redirectWithMessage(
      "Ad credit applied. Campaign payment is covered.",
      returnTo,
    );
  }

  const { data: reservedCampaign, error: reserveError } = await supabase
    .from("ad_campaigns")
    .update({
      payment_status: "checkout_started",
      platform_fee_cents: platformFeeCents,
      prepaid_amount_cents: prepaidAmountCents,
      stripe_checkout_session_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id)
    .eq("advertiser_id", claims.sub)
    .in("payment_status", ["unpaid", "payment_failed", "refunded"])
    .select("id")
    .maybeSingle<{ id: string }>();

  if (reserveError) {
    console.error("Ad checkout reservation failed.", reserveError);
    return redirectWithMessage(
      "The ad payment could not be reserved before checkout. Please try again.",
      returnTo,
    );
  }

  if (!reservedCampaign) {
    return redirectWithMessage(
      "Ad checkout has already started. Finish that checkout or wait for it to expire before trying again.",
      returnTo,
    );
  }

  const checkoutAttemptId = crypto.randomUUID();
  let session: StripeCheckoutSession;
  const rollBackReservation = async () => {
    const { data: releasedCampaign, error: releaseError } = await supabase
      .from("ad_campaigns")
      .update({
        payment_status: campaign.payment_status,
        platform_fee_cents: campaign.platform_fee_cents,
        prepaid_amount_cents: campaign.prepaid_amount_cents,
        stripe_checkout_session_id: campaign.stripe_checkout_session_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("advertiser_id", claims.sub)
      .eq("payment_status", "checkout_started")
      .is("stripe_checkout_session_id", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (releaseError) {
      console.error("Ad checkout reservation release failed.", releaseError);
      return false;
    }

    return Boolean(releasedCampaign);
  };

  try {
    session = await createAdCheckoutSession({
      campaign,
      idempotencyKey: `ttc_ad_${campaign.id}_${checkoutAttemptId}`,
      platformFeeCents,
      prepaidAmountCents,
      returnTo,
      secretKey,
    });
  } catch (error) {
    console.error("Ad checkout session creation failed.", error);

    if (
      error instanceof StripeCheckoutRequestError &&
      error.outcomeUnknown
    ) {
      return redirectWithMessage(
        "Checkout status could not be confirmed. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    const released = await rollBackReservation();

    if (!released) {
      console.error("Ad checkout reservation release could not be confirmed.");
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      "Checkout could not open for this ad. Please try again.",
      returnTo,
    );
  }

  const releaseSessionAndReservation = () =>
    expireCheckoutSessionBeforeRollback({
      idempotencyKey: `ttc_ad_expire_${campaign.id}_${checkoutAttemptId}`,
      rollback: rollBackReservation,
      secretKey,
      sessionId: session.id,
    });

  if (!session.url) {
    const released = await releaseSessionAndReservation();

    if (!released) {
      console.error("Ad checkout expiration could not be confirmed.");
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      `${siteName} could not open checkout for this ad campaign.`,
      returnTo,
    );
  }

  const { data: updatedCampaign, error: updateError } = await supabase
    .from("ad_campaigns")
    .update({
      payment_status: "checkout_started",
      platform_fee_cents: platformFeeCents,
      prepaid_amount_cents: prepaidAmountCents,
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id)
    .eq("advertiser_id", claims.sub)
    .eq("payment_status", "checkout_started")
    .is("stripe_checkout_session_id", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (updateError) {
    console.error("Ad checkout session save failed.", updateError);
    const released = await releaseSessionAndReservation();

    if (!released) {
      console.error("Ad checkout expiration could not be confirmed.");
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      "Checkout started, but the checkout could not be saved. Please contact support if this repeats.",
      returnTo,
    );
  }

  if (!updatedCampaign) {
    const released = await releaseSessionAndReservation();

    if (!released) {
      console.error("Ad checkout expiration could not be confirmed.");
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      "Ad checkout was reserved, but checkout could not finish opening. Wait for it to expire before trying again.",
      returnTo,
    );
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/ads");

  return NextResponse.redirect(session.url, { status: 303 });
}
