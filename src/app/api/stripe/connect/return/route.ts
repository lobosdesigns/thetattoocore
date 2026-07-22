import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { stripeConnectStatus } from "@/lib/stripe/connect";
import { createStripeClient, stripeCheckoutPreflight } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

function accountRedirect(message: string, payoutStatus = "retry") {
  return NextResponse.redirect(
    `${siteUrl}/account?message=${encodeURIComponent(message)}&payout_status=${encodeURIComponent(
      payoutStatus,
    )}#order-settings`,
    { status: 303 },
  );
}

export async function GET() {
  const stripe = createStripeClient();
  const admin = createAdminClient();
  const checkoutPreflight = stripeCheckoutPreflight();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(
      `${siteUrl}/login?return_to=${encodeURIComponent("/account#order-settings")}`,
      { status: 303 },
    );
  }

  if (!stripe || !admin || !checkoutPreflight.ready) {
    return accountRedirect("Seller payout setup could not be checked.", "check_failed");
  }

  const livemode = checkoutPreflight.actual;

  const { data: connectAccount, error: connectAccountError } = await admin
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("profile_id", claims.sub)
    .eq("livemode", livemode)
    .maybeSingle<{ stripe_account_id: string }>();

  if (connectAccountError) {
    console.error("Seller payout return lookup failed.", connectAccountError);
    return accountRedirect(
      "Seller payout setup could not be checked. Please try again.",
      "check_failed",
    );
  }

  if (!connectAccount?.stripe_account_id) {
    return accountRedirect("Seller payout setup was not found. Start setup again.", "not_found");
  }

  try {
    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);
    const status = stripeConnectStatus(account, livemode);

    const { error: updateError } = await admin
      .from("stripe_connect_accounts")
      .update(status)
      .eq("profile_id", claims.sub)
      .eq("livemode", livemode);

    if (updateError) {
      console.error("Seller payout return sync failed.", updateError);
      return accountRedirect(
        "Seller payout setup could not be checked. Please try again.",
        "check_failed",
      );
    }

    if (status.charges_enabled && status.payouts_enabled && status.details_submitted) {
      return accountRedirect("Seller payout setup is complete.", "complete");
    }

    return accountRedirect(
      "Seller payout setup is saved. More details may still be needed before payouts are active.",
      "needs_more",
    );
  } catch (error) {
    console.error("Seller payout return check failed.", error);
    return accountRedirect(
      "Seller payout setup could not be checked. Please try again.",
      "check_failed",
    );
  }
}
