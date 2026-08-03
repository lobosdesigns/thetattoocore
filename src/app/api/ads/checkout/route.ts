import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adCreditPackageForProductId } from "@/lib/ads/credit-packages";
import {
  adCheckoutBodyAllowed,
  parseAdCheckoutForm,
  readBoundedAdCheckoutForm,
} from "@/lib/ads/web-checkout";
import {
  adPurchaseSurfaceEnabled,
  adPurchaseSurfaceFromUserAgent,
} from "@/lib/commerce-launch";
import { siteName, siteUrl } from "@/lib/site";
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  StripeCheckoutRequestError,
  type StripeCheckoutSession,
} from "@/lib/stripe/checkout-session";
import { stripeCheckoutCreationMasterEnabled } from "@/lib/stripe/release-gates";
import { stripeCheckoutPreflight } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

type AdCreditPackage = {
  creditCents: number;
  webPriceCents: number;
};

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

async function createAdCreditCheckoutSession({
  creditPackage,
  idempotencyKey,
  productId,
  profileId,
  returnTo,
  secretKey,
}: {
  creditPackage: AdCreditPackage;
  idempotencyKey: string;
  productId: string;
  profileId: string;
  returnTo: string | null;
  secretKey: string;
}) {
  const successUrl = `${siteUrl}${pathWithMessage(
    returnTo,
    "Ad credit payment received. Credit updates after payment confirmation.",
  )}`;
  const cancelUrl = `${siteUrl}${pathWithMessage(
    returnTo,
    "Ad credit payment canceled.",
  )}`;
  const body = new URLSearchParams({
    allow_promotion_codes: "false",
    billing_address_collection: "auto",
    client_reference_id: profileId,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][description]":
      "Non-expiring credit for approved sponsored campaigns.",
    "line_items[0][price_data][product_data][metadata][ad_credit_product_id]":
      productId,
    "line_items[0][price_data][product_data][name]": `${siteName} ad credit`,
    "line_items[0][price_data][unit_amount]": String(
      creditPackage.webPriceCents,
    ),
    "line_items[0][quantity]": "1",
    "metadata[ad_credit_product_id]": productId,
    "metadata[credit_cents]": String(creditPackage.creditCents),
    "metadata[payment_kind]": "ad_credit_purchase",
    "metadata[profile_id]": profileId,
    mode: "payment",
    "payment_intent_data[metadata][ad_credit_product_id]": productId,
    "payment_intent_data[metadata][credit_cents]": String(
      creditPackage.creditCents,
    ),
    "payment_intent_data[metadata][payment_kind]": "ad_credit_purchase",
    "payment_intent_data[metadata][profile_id]": profileId,
    submit_type: "pay",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return createStripeCheckoutSession({
    body,
    checkoutCreationEnabled: stripeCheckoutCreationMasterEnabled() &&
      adPurchaseSurfaceEnabled("web"),
    idempotencyKey,
    secretKey,
  });
}

export async function POST(request: Request) {
  const surface = adPurchaseSurfaceFromUserAgent(
    request.headers.get("user-agent"),
  );
  if (!adPurchaseSurfaceEnabled(surface)) {
    return redirectWithMessage("Ad purchases are not available yet.");
  }

  if (!adCheckoutBodyAllowed(request.headers.get("content-length"))) {
    return redirectWithMessage("Choose a valid ad credit option.");
  }

  let formData: FormData | null = null;
  try {
    formData = await readBoundedAdCheckoutForm(request);
  } catch {
    return redirectWithMessage("Choose a valid ad credit option.");
  }

  if (!formData) {
    return redirectWithMessage("Choose a valid ad credit option.");
  }

  const intent = parseAdCheckoutForm(formData);
  if (!intent) return redirectWithMessage("Choose a valid ad credit option.");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;
  const profileId = claims?.sub?.toLowerCase();

  if (!profileId) {
    return NextResponse.redirect(
      `${siteUrl}/login?message=${encodeURIComponent("Sign in to manage ad credit.")}&return_to=${encodeURIComponent(intent.returnTo ?? "/account#advertising-settings")}`,
      { status: 303 },
    );
  }

  if (intent.kind === "campaign") {
    const { data: creditApplied, error: creditError } = await supabase.rpc(
      "spend_ad_credit_for_campaign",
      { p_campaign_id: intent.campaignId },
    );

    if (creditError) {
      console.error("Ad credit spend failed.", creditError);
      return redirectWithMessage(
        "Ad credit could not be applied. Please try again.",
        intent.returnTo,
      );
    }

    if (creditApplied !== true) {
      return redirectWithMessage(
        "Add enough ad credit before funding this campaign.",
        intent.returnTo,
      );
    }

    revalidatePath("/account");
    revalidatePath("/admin");
    revalidatePath("/admin/ads");
    return redirectWithMessage(
      "Ad credit applied. Campaign payment is covered.",
      intent.returnTo,
    );
  }

  if (surface !== "web") {
    return redirectWithMessage(
      "Use this device's purchase option to add ad credit.",
      intent.returnTo,
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const canProcessStripeWebhooks = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const creditPackage = adCreditPackageForProductId(intent.productId);

  if (!creditPackage || !secretKey || !canProcessStripeWebhooks) {
    return redirectWithMessage(
      "Ad credit checkout is temporarily unavailable. Please try again later.",
      intent.returnTo,
    );
  }

  const checkoutPreflight = stripeCheckoutPreflight();
  if (!checkoutPreflight.ready || !stripeCheckoutCreationMasterEnabled()) {
    console.error("Ad credit checkout mode preflight failed.", checkoutPreflight);
    return redirectWithMessage(
      "Ad credit checkout is temporarily unavailable. Please try again later.",
      intent.returnTo,
    );
  }

  const checkoutAttemptId = crypto.randomUUID();
  let session: StripeCheckoutSession;

  try {
    session = await createAdCreditCheckoutSession({
      creditPackage,
      idempotencyKey: `ttc_ad_credit_${profileId}_${checkoutAttemptId}`,
      productId: intent.productId,
      profileId,
      returnTo: intent.returnTo,
      secretKey,
    });
  } catch (error) {
    console.error("Ad credit checkout session creation failed.", error);
    return redirectWithMessage(
      error instanceof StripeCheckoutRequestError && error.outcomeUnknown
        ? "Checkout status could not be confirmed. Please wait before trying again or contact Support."
        : "Ad credit checkout could not open. Please try again.",
      intent.returnTo,
    );
  }

  if (!session.url) {
    await expireStripeCheckoutSession({
      idempotencyKey: `ttc_ad_credit_expire_${checkoutAttemptId}`,
      secretKey,
      sessionId: session.id,
    });
    return redirectWithMessage(
      "Ad credit checkout could not open. Please try again.",
      intent.returnTo,
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
