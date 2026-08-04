import { NextResponse } from "next/server";
import {
  adCreditPackageForProductId,
  isAdCreditProductId,
} from "@/lib/ads/credit-packages";
import {
  appleStoreConfiguration,
  cleanAppleSignedTransaction,
  confirmVerifiedAdCreditPurchase,
  isAppleStoreEnvironmentAllowed,
  isProfileId,
  readBoundedJsonObject,
  verifyAppleSignedTransaction,
  type AdPurchaseRpcClient,
} from "@/lib/ads/purchase-grant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedBodyKeys = new Set(["grantId", "signedTransactionJWS"]);
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: privateHeaders, status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authenticatedProfileId = claimsData?.claims?.sub;
  const profileId = isProfileId(authenticatedProfileId)
    ? authenticatedProfileId.toLowerCase()
    : null;

  if (!profileId) {
    return privateJson(
      {
        authenticated: false,
        confirmed: false,
        error: "Sign in required.",
        ok: false,
      },
      401,
    );
  }

  const bodyResult = await readBoundedJsonObject(request, allowedBodyKeys);
  if (!bodyResult.ok) {
    return privateJson(
      {
        authenticated: true,
        confirmed: false,
        error: "Enter a valid Apple purchase confirmation.",
        ok: false,
      },
      bodyResult.status,
    );
  }

  const grantId = isProfileId(bodyResult.value.grantId)
    ? bodyResult.value.grantId.toLowerCase()
    : null;
  const signedTransaction = cleanAppleSignedTransaction(
    bodyResult.value.signedTransactionJWS,
  );
  const configuration = appleStoreConfiguration();
  const admin = createAdminClient();

  if (!grantId || !signedTransaction) {
    return privateJson(
      {
        authenticated: true,
        confirmed: false,
        error: "Enter a valid Apple purchase confirmation.",
        ok: false,
      },
      400,
    );
  }
  if (!configuration || !admin) {
    return privateJson(
      {
        authenticated: true,
        confirmed: false,
        error: "Apple purchase confirmation is unavailable.",
        ok: false,
      },
      503,
    );
  }

  const transaction = await verifyAppleSignedTransaction(
    signedTransaction,
    configuration,
  );
  const productId = isAdCreditProductId(transaction?.productId)
    ? transaction.productId
    : null;
  const creditPackage = adCreditPackageForProductId(productId);
  const transactionId = transaction?.transactionId;
  const appAccountToken = transaction?.appAccountToken;

  if (
    !transaction ||
    !creditPackage ||
    !productId ||
    typeof transactionId !== "string" ||
    !/^\d{1,64}$/.test(transactionId) ||
    appAccountToken !== profileId ||
    transaction.bundleId !== configuration.bundleId ||
    !isAppleStoreEnvironmentAllowed(transaction.environment, configuration) ||
    transaction.type !== "Consumable" ||
    transaction.quantity !== 1 ||
    transaction.revocationDate !== undefined
  ) {
    return privateJson(
      {
        authenticated: true,
        confirmed: false,
        error: "Apple purchase confirmation failed.",
        ok: false,
      },
      400,
    );
  }

  const confirmation = await confirmVerifiedAdCreditPurchase(
    admin as unknown as AdPurchaseRpcClient,
    {
      creditCents: creditPackage.creditCents,
      grantId,
      origin: "apple_iap",
      productId,
      profileId,
      providerTransactionId: transactionId,
    },
  );

  if (!confirmation.ok) {
    return privateJson(
      {
        authenticated: true,
        confirmed: false,
        error: "Apple purchase grant does not match this transaction.",
        ok: false,
      },
      409,
    );
  }

  return privateJson({
    authenticated: true,
    confirmed: true,
    grantId: confirmation.grantId,
    ok: true,
    productId,
    profileId,
    transactionId,
  });
}
