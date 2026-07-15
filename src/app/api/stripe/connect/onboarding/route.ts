import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { createStripeClient } from "@/lib/stripe/server";
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
  suspended_at: string | null;
  banned_at: string | null;
};

function accountRedirect(message: string) {
  return NextResponse.redirect(
    `${siteUrl}/account?message=${encodeURIComponent(message)}#order-settings`,
    { status: 303 },
  );
}

export async function POST() {
  const stripe = createStripeClient();
  const admin = createAdminClient();

  if (!stripe || !admin) {
    return accountRedirect("Seller payout setup is temporarily unavailable.");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(
      `${siteUrl}/login?return_to=${encodeURIComponent("/account#order-settings")}`,
      { status: 303 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, account_type, country_code, license_verified_at, suspended_at, banned_at")
    .eq("id", claims.sub)
    .maybeSingle<Profile>();

  if (
    !profile ||
    profile.suspended_at ||
    profile.banned_at ||
    !isVerifiedProfessional(profile)
  ) {
    return accountRedirect(
      "Verified artist, studio, or vendor status is required before payout setup.",
    );
  }

  const { data: existingAccount } = await admin
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("profile_id", claims.sub)
    .maybeSingle<{ stripe_account_id: string }>();

  let stripeAccountId = existingAccount?.stripe_account_id ?? null;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      business_profile: {
        name: profile.display_name || "TheTattooCore seller",
        product_description: "Body-art community merch, art, prints, apparel, and brand goods.",
        url: siteUrl,
      },
      business_type: profile.account_type === "studio" ? "company" : "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      country: profile.country_code || "US",
      email: claims.email,
      metadata: {
        profile_id: claims.sub,
        source: "thetattoocore",
      },
      type: "express",
    });

    stripeAccountId = account.id;

    await admin.from("stripe_connect_accounts").upsert({
      ...stripeConnectStatus(account),
      onboarding_started_at: new Date().toISOString(),
      profile_id: claims.sub,
    });
  } else {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    await admin.from("stripe_connect_accounts").upsert({
      ...stripeConnectStatus(account),
      onboarding_started_at: new Date().toISOString(),
      profile_id: claims.sub,
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${siteUrl}/account?message=${encodeURIComponent(
      "Seller payout setup expired. Start it again when you are ready.",
    )}#order-settings`,
    return_url: `${siteUrl}/api/stripe/connect/return`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(accountLink.url, { status: 303 });
}
