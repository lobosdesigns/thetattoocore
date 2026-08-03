import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  adCreditPackageForProductId,
  isAdCreditProductId,
} from "@/lib/ads/credit-packages";
import {
  cleanGooglePendingRefundToken,
  cleanGooglePurchaseToken,
  consumeGooglePlayProduct,
  googlePendingRefundReviewAuditKey,
  googlePlayConfiguration,
  grantVerifiedAdCreditPurchase,
  isProviderTransactionId,
  readBoundedJsonObject,
  reconcileVerifiedAdCreditPurchase,
  reviewGooglePendingRefund,
  resolveGoogleAdPurchaseProfile,
  verifyGooglePlayProductPurchase,
  verifyGooglePubSubPush,
  type AdPurchaseRpcClient,
} from "@/lib/ads/purchase-grant";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedEnvelopeKeys = new Set(["message", "subscription"]);
const allowedPendingRefundKeys = new Set([
  "obfuscatedAccountId",
  "obfuscatedProfileId",
  "orderId",
  "pendingRefundToken",
  "refundReason",
  "version",
]);
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};

function callbackJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders, status });
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function decodeDeveloperNotification(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 4 ||
    value.length > 20_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.byteLength > 12_000) return null;
    const parsed: unknown = JSON.parse(decoded.toString("utf8"));
    return objectValue(parsed);
  } catch {
    return null;
  }
}

function isPendingRefundReviewNotification(
  value: Record<string, unknown>,
) {
  const pendingRefundToken = cleanGooglePendingRefundToken(
    value.pendingRefundToken,
  );
  const orderId = value.orderId;
  const obfuscatedAccountId = value.obfuscatedAccountId;
  const obfuscatedProfileId = value.obfuscatedProfileId;

  return (
    Object.keys(value).every((key) => allowedPendingRefundKeys.has(key)) &&
    value.version === "1.0" &&
    pendingRefundToken !== null &&
    isProviderTransactionId(orderId) &&
    orderId.length <= 200 &&
    value.refundReason === 7 &&
    (obfuscatedAccountId === undefined ||
      (typeof obfuscatedAccountId === "string" &&
        /^[0-9a-f]{64}$/.test(obfuscatedAccountId))) &&
    (obfuscatedProfileId === undefined ||
      (typeof obfuscatedProfileId === "string" &&
        /^[A-Za-z0-9._-]{1,64}$/.test(obfuscatedProfileId)))
  );
}

export async function POST(request: Request) {
  const configuration = googlePlayConfiguration();
  const admin = createAdminClient();
  if (!configuration || !admin) {
    return callbackJson({ error: "Notification verification is unavailable." }, 503);
  }
  if (!(await verifyGooglePubSubPush(request, configuration))) {
    return callbackJson({ error: "Invalid notification." }, 401);
  }

  const bodyResult = await readBoundedJsonObject(request, allowedEnvelopeKeys);
  if (!bodyResult.ok) {
    return callbackJson({ error: "Invalid notification." }, bodyResult.status);
  }
  if (bodyResult.value.subscription !== configuration.pubSubSubscription) {
    return callbackJson({ error: "Invalid notification." }, 400);
  }

  const message = objectValue(bodyResult.value.message);
  const messageId = message?.messageId ?? message?.message_id;
  const developerNotification = decodeDeveloperNotification(message?.data);
  if (
    typeof messageId !== "string" ||
    !/^\d{1,128}$/.test(messageId) ||
    !developerNotification ||
    developerNotification.packageName !== configuration.packageName ||
    developerNotification.version !== "1.0"
  ) {
    return callbackJson({ error: "Invalid notification." }, 400);
  }

  const eventFields = [
    "oneTimeProductNotification",
    "voidedPurchaseNotification",
    "subscriptionNotification",
    "pendingRefundReviewNotification",
    "testNotification",
  ].filter((field) => developerNotification[field] !== undefined);
  if (eventFields.length !== 1) {
    return callbackJson({ error: "Invalid notification." }, 400);
  }
  if (eventFields[0] === "testNotification") {
    return callbackJson({ ok: true });
  }

  if (eventFields[0] === "pendingRefundReviewNotification") {
    const pendingRefund = objectValue(
      developerNotification.pendingRefundReviewNotification,
    );
    if (!pendingRefund || !isPendingRefundReviewNotification(pendingRefund)) {
      return callbackJson({ error: "Invalid notification." }, 400);
    }

    const reviewed = await reviewGooglePendingRefund({
      configuration,
      orderId: pendingRefund.orderId as string,
      pendingRefundToken: pendingRefund.pendingRefundToken as string,
    });
    if (!reviewed) {
      console.error("Google Play pending refund review response failed.");
      return callbackJson({ error: "Notification processing failed." }, 503);
    }

    const operationKey = await googlePendingRefundReviewAuditKey(
      messageId,
      pendingRefund.pendingRefundToken,
    );
    if (!operationKey) {
      return callbackJson({ error: "Invalid notification." }, 400);
    }

    const { error: auditError } = await admin.from("admin_audit_logs").insert({
      actor_id: null,
      event_type: "google_play_refund_review_neutral",
      metadata: {
        provider: "google_play",
        recommendation: "neutral",
        refund_reason: "chargeback",
      },
      operation_key: operationKey,
      summary: "Google Play chargeback review received a neutral recommendation.",
      target_id: null,
      target_type: "google_play_refund_review",
    });
    if (auditError && auditError.code !== "23505") {
      console.error("Google Play pending refund review audit failed.");
      return callbackJson({ error: "Notification processing failed." }, 500);
    }

    revalidatePath("/admin/payments");
    return callbackJson({ ok: true });
  }

  const rpcClient = admin as unknown as AdPurchaseRpcClient;
  const providerEventId = `google:${messageId}`;
  const voided = objectValue(developerNotification.voidedPurchaseNotification);
  if (voided) {
    const purchaseToken = cleanGooglePurchaseToken(voided.purchaseToken);
    if (
      !purchaseToken ||
      voided.productType !== 2 ||
      voided.refundType !== 1 ||
      !isProviderTransactionId(voided.orderId) ||
      voided.orderId.length > 200
    ) {
      return callbackJson({ error: "Invalid notification." }, 400);
    }
    const reconciliation = await reconcileVerifiedAdCreditPurchase(rpcClient, {
      action: "terminal_void",
      fullPurchase: true,
      origin: "google_play",
      productId: null,
      profileId: null,
      providerAmountCents: null,
      providerCurrency: null,
      providerEventId,
      providerLifecycleId: `google-void:${voided.orderId}`,
      providerPaidAmountCents: null,
      providerTransactionId: purchaseToken,
      purchaseCreditCents: null,
      reason: "refund",
      reconciliationCreditCents: null,
    });
    if (!reconciliation.ok) {
      console.error("Google Play voided purchase reconciliation failed.");
      return callbackJson({ error: "Notification processing failed." }, 500);
    }
    revalidatePath("/account");
    revalidatePath("/admin/payments");
    return callbackJson({ ok: true });
  }

  const oneTime = objectValue(developerNotification.oneTimeProductNotification);
  if (!oneTime) {
    return callbackJson({ ok: true });
  }
  const productId = isAdCreditProductId(oneTime.sku) ? oneTime.sku : null;
  const creditPackage = adCreditPackageForProductId(productId);
  const purchaseToken = cleanGooglePurchaseToken(oneTime.purchaseToken);
  if (
    oneTime.version !== "1.0" ||
    !creditPackage ||
    !productId ||
    !purchaseToken ||
    (oneTime.notificationType !== 1 && oneTime.notificationType !== 2)
  ) {
    return callbackJson({ error: "Invalid notification." }, 400);
  }
  if (oneTime.notificationType === 2) {
    const reconciliation = await reconcileVerifiedAdCreditPurchase(rpcClient, {
      action: "terminal_void",
      fullPurchase: true,
      origin: "google_play",
      productId,
      profileId: null,
      providerAmountCents: null,
      providerCurrency: null,
      providerEventId,
      providerLifecycleId: `google-cancel:${purchaseToken}`,
      providerPaidAmountCents: null,
      providerTransactionId: purchaseToken,
      purchaseCreditCents: creditPackage.creditCents,
      reason: "cancellation",
      reconciliationCreditCents: creditPackage.creditCents,
    });
    if (!reconciliation.ok) {
      console.error("Google Play canceled purchase reconciliation failed.");
      return callbackJson({ error: "Notification processing failed." }, 500);
    }
    revalidatePath("/account");
    revalidatePath("/admin/payments");
    return callbackJson({ ok: true });
  }

  const purchase = await verifyGooglePlayProductPurchase(
    purchaseToken,
    configuration,
  );
  if (
    !purchase ||
    purchase.purchaseState !== "PURCHASED" ||
    purchase.productId !== productId ||
    purchase.quantity !== 1 ||
    purchase.refundableQuantity !== 1 ||
    !purchase.obfuscatedExternalAccountId ||
    (purchase.isTestPurchase && !configuration.allowTestPurchases)
  ) {
    return callbackJson({ error: "Notification purchase verification failed." }, 400);
  }

  const profileId = await resolveGoogleAdPurchaseProfile(
    rpcClient,
    purchase.obfuscatedExternalAccountId,
  );
  if (!profileId) {
    return callbackJson({ error: "Notification account is not available." }, 500);
  }

  const grant = await grantVerifiedAdCreditPurchase(rpcClient, {
    creditCents: creditPackage.creditCents,
    origin: "google_play",
    productId,
    profileId,
    providerTransactionId: purchaseToken,
  });
  if (!grant.ok) {
    console.error("Google Play purchase notification grant failed.");
    return callbackJson({ error: "Notification processing failed." }, 500);
  }

  if (purchase.consumptionState !== "CONSUMPTION_STATE_CONSUMED") {
    const consumed = await consumeGooglePlayProduct({
      accessToken: purchase.accessToken,
      configuration,
      productId,
      purchaseToken,
    });
    if (!consumed) {
      console.error("Google Play notification consumption failed after durable grant.");
      return callbackJson({ error: "Notification processing failed." }, 500);
    }
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");
  return callbackJson({ ok: true });
}
