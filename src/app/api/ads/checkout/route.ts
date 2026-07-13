import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  calculatePlatformFeeCents,
  platformFeeDescription,
} from "@/lib/payments/fees";
import { siteName, siteUrl } from "@/lib/site";
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

type CheckoutSession = {
  id: string;
  url: string | null;
};

function redirectWithMessage(path: string, message: string) {
  return NextResponse.redirect(
    `${siteUrl}${path}?message=${encodeURIComponent(message)}#advertising-settings`,
    { status: 303 },
  );
}

async function createAdCheckoutSession({
  campaign,
  platformFeeCents,
  prepaidAmountCents,
}: {
  campaign: AdCampaign;
  platformFeeCents: number;
  prepaidAmountCents: number;
}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Checkout is almost ready. Payment setup is still being finished.");
  }

  const successUrl = `${siteUrl}/account?message=${encodeURIComponent(
    "Ad payment received. Payment status will update soon.",
  )}#advertising-settings`;
  const cancelUrl = `${siteUrl}/account?message=${encodeURIComponent(
    "Ad payment canceled.",
  )}#advertising-settings`;
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

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const session = (await response.json()) as
    | CheckoutSession
    | { error?: { message?: string } };

  if (!response.ok || !("id" in session)) {
    const message =
      "error" in session && session.error?.message
        ? session.error.message
        : "Checkout could not open for this ad.";

    throw new Error(message);
  }

  return session;
}

export async function POST(request: Request) {
  const canProcessStripeWebhooks = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!process.env.STRIPE_SECRET_KEY) {
    return redirectWithMessage(
      "/account",
      "Ad checkout is almost ready. Payment setup is still being finished.",
    );
  }

  if (!canProcessStripeWebhooks) {
    return redirectWithMessage(
      "/account",
      "Ad checkout is almost ready. Payment setup is still being finished.",
    );
  }

  const formData = await request.formData();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();

  if (!campaignId) {
    return redirectWithMessage("/account", "Choose an ad campaign first.");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(
      `${siteUrl}/login?message=${encodeURIComponent("Sign in to pay for ads.")}`,
      { status: 303 },
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
    return redirectWithMessage("/account", "That ad campaign was not found.");
  }

  if (!["pending_review", "approved", "paused"].includes(campaign.status)) {
    return redirectWithMessage(
      "/account",
      "Only pending, approved, or paused ads can start checkout.",
    );
  }

  if (campaign.payment_status === "paid") {
    return redirectWithMessage("/account", "That ad campaign is already paid.");
  }

  if (campaign.payment_status === "waived") {
    return redirectWithMessage(
      "/account",
      "That ad campaign payment has been waived.",
    );
  }

  if (campaign.payment_status === "checkout_started") {
    return redirectWithMessage(
      "/account",
      "Ad checkout has already started. Finish that checkout or wait for it to expire before trying again.",
    );
  }

  if (campaign.daily_budget_cents <= 0) {
    return redirectWithMessage(
      "/account",
      "Add a daily budget before starting ad checkout.",
    );
  }

  const prepaidAmountCents = campaign.daily_budget_cents;
  const platformFeeCents = calculatePlatformFeeCents(prepaidAmountCents);
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
    return redirectWithMessage(
      "/account",
      reserveError.message || "The ad payment could not be reserved before checkout.",
    );
  }

  if (!reservedCampaign) {
    return redirectWithMessage(
      "/account",
      "Ad checkout has already started. Finish that checkout or wait for it to expire before trying again.",
    );
  }

  let session: CheckoutSession;
  const rollBackReservation = async () => {
    await supabase
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
      .is("stripe_checkout_session_id", null);
  };

  try {
    session = await createAdCheckoutSession({
      campaign,
      platformFeeCents,
      prepaidAmountCents,
    });
  } catch (error) {
    await rollBackReservation();
    return redirectWithMessage(
      "/account",
      error instanceof Error ? error.message : "Checkout could not open for this ad.",
    );
  }

  if (!session.url) {
    await rollBackReservation();
    return redirectWithMessage(
      "/account",
      `${siteName} could not open checkout for this ad campaign.`,
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
    return redirectWithMessage(
      "/account",
      updateError.message || "Checkout started, but the checkout could not be saved.",
    );
  }

  if (!updatedCampaign) {
    return redirectWithMessage(
      "/account",
      "Ad checkout was reserved, but checkout could not finish opening. Wait for it to expire before trying again.",
    );
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/ads");

  return NextResponse.redirect(session.url, { status: 303 });
}
