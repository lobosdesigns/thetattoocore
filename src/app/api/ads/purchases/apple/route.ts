import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  adCreditPackageForProductId,
  isAdCreditProductId,
} from "@/lib/ads/credit-packages";
import {
  appleStoreConfiguration,
  cleanAppleSignedTransaction,
  grantVerifiedAdCreditPurchase,
  isAppleStoreEnvironmentAllowed,
  readBoundedJsonObject,
  verifyAppleSignedTransaction,
  type AdPurchaseRpcClient,
} from "@/lib/ads/purchase-grant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedBodyKeys = new Set(["signedTransaction"]);
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: privateHeaders, status });
}

export async function POST(request: Request) {
  if (process.env.TTC_IOS_AD_PURCHASES_ENABLED !== "true") {
    return privateJson({ error: "Ad credit purchases are not available." }, 503);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const profileId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub.toLowerCase()
      : null;

  if (!profileId) {
    return privateJson({ error: "Sign in required." }, 401);
  }

  const bodyResult = await readBoundedJsonObject(request, allowedBodyKeys);
  if (!bodyResult.ok) {
    return privateJson(
      { error: "Enter a valid Apple purchase." },
      bodyResult.status,
    );
  }

  const signedTransaction = cleanAppleSignedTransaction(
    bodyResult.value.signedTransaction,
  );
  const configuration = appleStoreConfiguration();
  const admin = createAdminClient();

  if (!signedTransaction) {
    return privateJson({ error: "Enter a valid Apple purchase." }, 400);
  }
  if (!configuration || !admin) {
    return privateJson({ error: "Apple purchase verification is unavailable." }, 503);
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
    return privateJson({ error: "Apple purchase verification failed." }, 400);
  }

  const grant = await grantVerifiedAdCreditPurchase(
    admin as unknown as AdPurchaseRpcClient,
    {
      creditCents: creditPackage.creditCents,
      origin: "apple_iap",
      productId,
      profileId,
      providerTransactionId: transactionId,
    },
  );

  if (!grant.ok) {
    console.error("Apple ad credit grant failed.");
    return privateJson({ error: "Apple purchase could not be recorded." }, 500);
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");

  return privateJson({
    creditCents: creditPackage.creditCents,
    duplicate: grant.outcome === "duplicate",
    grantId: grant.grantId,
    ok: true,
  });
}
