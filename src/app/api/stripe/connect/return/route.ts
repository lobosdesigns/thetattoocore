import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { stripeConnectStatus } from "@/lib/stripe/connect";
import { createStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

function accountRedirect(message: string) {
  return NextResponse.redirect(
    `${siteUrl}/account?message=${encodeURIComponent(message)}#order-settings`,
    { status: 303 },
  );
}

export async function GET() {
  const stripe = createStripeClient();
  const admin = createAdminClient();

  if (!stripe || !admin) {
    return accountRedirect("Seller payout setup could not be checked.");
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

  const { data: connectAccount, error: connectAccountError } = await admin
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("profile_id", claims.sub)
    .maybeSingle<{ stripe_account_id: string }>();

  if (connectAccountError) {
    console.error("Seller payout return lookup failed.", connectAccountError);
    return accountRedirect("Seller payout setup could not be checked. Please try again.");
  }

  if (!connectAccount?.stripe_account_id) {
    return accountRedirect("Seller payout setup was not found. Start setup again.");
  }

  try {
    const account = await stripe.accounts.retrieve(connectAccount.stripe_account_id);
    const status = stripeConnectStatus(account);

    const { error: updateError } = await admin
      .from("stripe_connect_accounts")
      .update(status)
      .eq("profile_id", claims.sub);

    if (updateError) {
      console.error("Seller payout return sync failed.", updateError);
      return accountRedirect("Seller payout setup could not be checked. Please try again.");
    }

    if (status.charges_enabled && status.payouts_enabled && status.details_submitted) {
      return accountRedirect("Seller payout setup is complete.");
    }

    return accountRedirect(
      "Seller payout setup is saved. More details may still be needed before payouts are active.",
    );
  } catch (error) {
    console.error("Seller payout return check failed.", error);
    return accountRedirect("Seller payout setup could not be checked. Please try again.");
  }
}
