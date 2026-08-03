import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { stripeConnectOnboardingEnabled } from "@/lib/stripe/release-gates";
import {
  createStripeClient,
  stripeConnectWebhookSigningSecretConfigured,
  stripeCheckoutPreflight,
} from "@/lib/stripe/server";
import { stripeConnectStatus } from "@/lib/stripe/connect";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  email?: string;
  sub: string;
};

type Profile = {
  account_type: string;
  country_code: string | null;
  display_name: string | null;
  id: string;
  license_verified_at: string | null;
  role: string;
  suspended_at: string | null;
  banned_at: string | null;
};

function payoutIssueCode(error: unknown) {
  return error && typeof error === "object" ? "provider_error" : "unknown_error";
}

function accountRedirect(message: string, payoutStatus = "retry", issue?: string) {
  const params = new URLSearchParams({
    message,
    payout_status: payoutStatus,
  });

  if (issue) params.set("payout_issue", issue);

  return NextResponse.redirect(
    `${siteUrl}/account?${params.toString()}#booking-settings`,
    { status: 303 },
  );
}

export async function POST() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(
      `${siteUrl}/login?return_to=${encodeURIComponent("/account#booking-settings")}`,
      { status: 303 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, account_type, country_code, license_verified_at, role, suspended_at, banned_at",
    )
    .eq("id", claims.sub)
    .maybeSingle<Profile>();

  if (
    !profile ||
    profile.suspended_at ||
    profile.banned_at ||
    !["artist", "studio"].includes(profile.account_type) ||
    !isVerifiedProfessional(profile)
  ) {
    return accountRedirect(
      "Verified artist or studio status is required before booking payment setup.",
      "needs_verification",
    );
  }

  const countryCode = profile.country_code?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return accountRedirect(
      "Add your two-letter country code in Profile settings before booking payment setup.",
      "needs_profile",
    );
  }

  if (!stripeConnectOnboardingEnabled()) {
    return accountRedirect("Booking payment setup is temporarily unavailable.", "unavailable");
  }

  const stripe = createStripeClient();
  const admin = createAdminClient();
  const checkoutPreflight = stripeCheckoutPreflight();
  const connectWebhookReady = stripeConnectWebhookSigningSecretConfigured();

  if (!stripe || !admin || !checkoutPreflight.ready || !connectWebhookReady) {
    return accountRedirect("Booking payment setup is temporarily unavailable.", "unavailable");
  }

  const livemode = checkoutPreflight.actual;

  let setupStep = "lookup";

  try {
    const { data: existingAccount, error: existingAccountError } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id, livemode")
      .eq("profile_id", claims.sub)
      .maybeSingle<{ livemode: boolean | null; stripe_account_id: string }>();

    if (existingAccountError) {
      console.error("Booking payment account lookup failed.", existingAccountError);
      return accountRedirect("Booking payment setup is temporarily unavailable.", "unavailable");
    }

    let stripeAccountId =
      existingAccount?.livemode === livemode ? existingAccount.stripe_account_id : null;

    if (!stripeAccountId) {
      setupStep = "account_create";
      const account = await stripe.accounts.create({
        business_profile: {
          name: profile.display_name || "TheTattooCore booking provider",
          product_description: "Tattoo appointment deposits and in-person body-art services.",
          url: siteUrl,
        },
        business_type: profile.account_type === "studio" ? "company" : "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        country: countryCode,
        email: claims.email,
        metadata: {
          profile_id: claims.sub,
          source: "thetattoocore",
        },
        type: "express",
      });

      stripeAccountId = account.id;

      setupStep = "account_create_sync";
      const { error: upsertError } = await admin.from("stripe_connect_accounts").upsert({
        ...stripeConnectStatus(account, livemode),
        onboarding_started_at: new Date().toISOString(),
        profile_id: claims.sub,
      });

      if (upsertError) {
        console.error("Booking payment account create sync failed.", upsertError);
        return accountRedirect("Booking payment setup is temporarily unavailable.", "unavailable");
      }
    } else {
      setupStep = "account_capabilities";
      const account = await stripe.accounts.update(stripeAccountId, {
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      setupStep = "account_status_sync";
      const { error: upsertError } = await admin.from("stripe_connect_accounts").upsert({
        ...stripeConnectStatus(account, livemode),
        onboarding_started_at: new Date().toISOString(),
        profile_id: claims.sub,
      });

      if (upsertError) {
        console.error("Booking payment account status sync failed.", upsertError);
        return accountRedirect("Booking payment setup is temporarily unavailable.", "unavailable");
      }
    }

    setupStep = "account_link";
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/account?message=${encodeURIComponent(
        "Booking payment setup expired. Start it again when you are ready.",
      )}&payout_status=expired#booking-settings`,
      return_url: `${siteUrl}/api/stripe/connect/return`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url, { status: 303 });
  } catch (error) {
    console.error("Booking payment onboarding failed.", error);
    return accountRedirect(
      "Booking payment setup is temporarily unavailable. Please try again.",
      "retry",
      `${typeof setupStep === "string" ? setupStep : "unknown"}:${payoutIssueCode(error)}`,
    );
  }
}
