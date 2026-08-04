import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  adCreditPackageForProductId,
  isAdCreditProductId,
} from "@/lib/ads/credit-packages";
import {
  cleanGooglePurchaseToken,
  grantVerifiedAdCreditPurchase,
  googlePlayAccountId,
  googlePlayConfiguration,
  readBoundedJsonObject,
  verifyGooglePlayProductPurchase,
  consumeGooglePlayProduct,
  type AdPurchaseRpcClient,
} from "@/lib/ads/purchase-grant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedBodyKeys = new Set(["productId", "purchaseToken"]);
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: privateHeaders, status });
}

export async function POST(request: Request) {
  if (process.env.TTC_ANDROID_AD_PURCHASES_ENABLED !== "true") {
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
      { error: "Enter a valid Google Play purchase." },
      bodyResult.status,
    );
  }

  const productId = isAdCreditProductId(bodyResult.value.productId)
    ? bodyResult.value.productId
    : null;
  const creditPackage = adCreditPackageForProductId(productId);
  const purchaseToken = cleanGooglePurchaseToken(bodyResult.value.purchaseToken);
  const configuration = googlePlayConfiguration();
  const admin = createAdminClient();

  if (!creditPackage || !productId || !purchaseToken) {
    return privateJson({ error: "Enter a valid Google Play purchase." }, 400);
  }
  if (!configuration || !admin) {
    return privateJson({ error: "Google Play purchase verification is unavailable." }, 503);
  }

  const purchase = await verifyGooglePlayProductPurchase(
    purchaseToken,
    configuration,
  );
  const expectedAccountId = googlePlayAccountId(profileId);
  const purchaseState = purchase?.purchaseState;

  if (
    !purchase ||
    purchaseState !== "PURCHASED" ||
    purchase.productId !== productId ||
    purchase.quantity !== 1 ||
    purchase.refundableQuantity !== 1 ||
    !expectedAccountId ||
    purchase.obfuscatedExternalAccountId !== expectedAccountId ||
    (purchase.isTestPurchase && !configuration.allowTestPurchases)
  ) {
    return privateJson({ error: "Google Play purchase verification failed." }, 400);
  }

  const grant = await grantVerifiedAdCreditPurchase(
    admin as unknown as AdPurchaseRpcClient,
    {
      creditCents: creditPackage.creditCents,
      origin: "google_play",
      productId,
      profileId,
      providerTransactionId: purchaseToken,
    },
  );

  if (!grant.ok) {
    console.error("Google Play ad credit grant failed.");
    return privateJson({ error: "Google Play purchase could not be recorded." }, 500);
  }

  if (purchase.consumptionState !== "CONSUMPTION_STATE_CONSUMED") {
    const consumed = await consumeGooglePlayProduct({
      accessToken: purchase.accessToken,
      configuration,
      productId,
      purchaseToken,
    });
    if (!consumed) {
      console.error("Google Play ad credit consumption failed after durable grant.");
      return privateJson(
        { error: "Google Play purchase needs another verification attempt." },
        503,
      );
    }
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");

  return privateJson({
    creditCents: creditPackage.creditCents,
    duplicate: grant.outcome === "duplicate",
    ok: true,
  });
}
