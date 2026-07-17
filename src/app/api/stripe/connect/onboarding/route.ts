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
  role: string;
  suspended_at: string | null;
  banned_at: string | null;
};

function payoutIssueCode(error: unknown) {
  if (!error || typeof error !== "object") return "unknown";

  const details = error as {
    code?: string;
    message?: string;
    param?: string;
    raw?: { code?: string; message?: string; param?: string; type?: string };
    type?: string;
  };
  const code = details.code ?? details.raw?.code ?? "unknown";
  const message = details.message ?? details.raw?.message ?? "no_message";
  const param = details.param ?? details.raw?.param ?? "none";
  const type = details.type ?? details.raw?.type ?? "error";

  return `${type}:${code}:${param}:${message}`
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
}

function accountRedirect(message: string, payoutStatus = "retry", issue?: string) {
  const params = new URLSearchParams({
    message,
    payout_status: payoutStatus,
  });

  if (issue) params.set("payout_issue", issue);

  return NextResponse.redirect(
    `${siteUrl}/account?${params.toString()}#order-settings`,
    { status: 303 },
  );
}

function sellerBusinessType(profile: Pick<Profile, "account_type" | "role">) {
  return profile.account_type === "studio" ||
    profile.account_type === "vendor" ||
    profile.role === "owner" ||
    profile.role === "admin"
    ? "company"
    : "individual";
}

export async function POST() {
  const stripe = createStripeClient();
  const admin = createAdminClient();

  if (!stripe || !admin) {
    return accountRedirect("Seller payout setup is temporarily unavailable.", "unavailable");
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
    .select(
      "id, display_name, account_type, country_code, license_verified_at, role, suspended_at, banned_at",
    )
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
      "needs_verification",
    );
  }

  let setupStep = "lookup";

  try {
    const { data: existingAccount, error: existingAccountError } = await admin
      .from("stripe_connect_accounts")
      .select("stripe_account_id")
      .eq("profile_id", claims.sub)
      .maybeSingle<{ stripe_account_id: string }>();

    if (existingAccountError) {
      console.error("Seller payout account lookup failed.", existingAccountError);
      return accountRedirect("Seller payout setup is temporarily unavailable.", "unavailable");
    }

    let stripeAccountId = existingAccount?.stripe_account_id ?? null;

    if (!stripeAccountId) {
      setupStep = "account_create";
      const account = await stripe.accounts.create({
        business_profile: {
          name: profile.display_name || "TheTattooCore seller",
          product_description: "Body-art community merch, art, prints, apparel, and brand goods.",
          url: siteUrl,
        },
        business_type: sellerBusinessType(profile),
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

      setupStep = "account_create_sync";
      const { error: upsertError } = await admin.from("stripe_connect_accounts").upsert({
        ...stripeConnectStatus(account),
        onboarding_started_at: new Date().toISOString(),
        profile_id: claims.sub,
      });

      if (upsertError) {
        console.error("Seller payout account create sync failed.", upsertError);
        return accountRedirect("Seller payout setup is temporarily unavailable.", "unavailable");
      }
    } else {
      setupStep = "account_retrieve";
      const account = await stripe.accounts.retrieve(stripeAccountId);

      setupStep = "account_status_sync";
      const { error: upsertError } = await admin.from("stripe_connect_accounts").upsert({
        ...stripeConnectStatus(account),
        onboarding_started_at: new Date().toISOString(),
        profile_id: claims.sub,
      });

      if (upsertError) {
        console.error("Seller payout account status sync failed.", upsertError);
        return accountRedirect("Seller payout setup is temporarily unavailable.", "unavailable");
      }
    }

    setupStep = "account_link";
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/account?message=${encodeURIComponent(
        "Seller payout setup expired. Start it again when you are ready.",
      )}&payout_status=expired#order-settings`,
      return_url: `${siteUrl}/api/stripe/connect/return`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url, { status: 303 });
  } catch (error) {
    console.error("Seller payout onboarding failed.", error);
    return accountRedirect(
      "Seller payout setup is temporarily unavailable. Please try again.",
      "retry",
      `${typeof setupStep === "string" ? setupStep : "unknown"}:${payoutIssueCode(error)}`,
    );
  }
}
