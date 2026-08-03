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
  isProfileId,
  readBoundedJsonObject,
  reconcileVerifiedAdCreditPurchase,
  verifyAppleSignedNotification,
  verifyAppleSignedTransaction,
  type AdPurchaseRpcClient,
} from "@/lib/ads/purchase-grant";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedBodyKeys = new Set(["signedPayload"]);
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};

function callbackJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders, status });
}

export async function POST(request: Request) {
  const bodyResult = await readBoundedJsonObject(request, allowedBodyKeys);
  if (!bodyResult.ok) {
    return callbackJson({ error: "Invalid notification." }, bodyResult.status);
  }

  const signedPayload = cleanAppleSignedTransaction(bodyResult.value.signedPayload);
  const configuration = appleStoreConfiguration();
  const admin = createAdminClient();
  if (!signedPayload) {
    return callbackJson({ error: "Invalid notification." }, 400);
  }
  if (!configuration || !admin) {
    return callbackJson({ error: "Notification verification is unavailable." }, 503);
  }

  const notification = await verifyAppleSignedNotification(
    signedPayload,
    configuration,
  );
  const notificationUUID = notification?.notificationUUID;
  const notificationType = notification?.notificationType;

  if (
    !notification ||
    notification.version !== "2.0" ||
    typeof notificationUUID !== "string" ||
    !isProfileId(notificationUUID) ||
    typeof notificationType !== "string"
  ) {
    return callbackJson({ error: "Invalid notification." }, 400);
  }

  if (notificationType === "TEST") {
    return callbackJson({ ok: true });
  }

  const data =
    notification.data &&
    typeof notification.data === "object" &&
    !Array.isArray(notification.data)
      ? (notification.data as Record<string, unknown>)
      : null;
  const notificationEnvironment = data?.environment;
  const signedTransaction = cleanAppleSignedTransaction(data?.signedTransactionInfo);

  if (
    !data ||
    data.bundleId !== configuration.bundleId ||
    !isAppleStoreEnvironmentAllowed(notificationEnvironment, configuration) ||
    (notificationEnvironment === "Production" &&
      data.appAppleId !== configuration.appAppleId) ||
    !signedTransaction
  ) {
    return callbackJson({ error: "Invalid notification." }, 400);
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
  const profileId = transaction?.appAccountToken;
  const transactionEnvironment = transaction?.environment;

  if (
    !transaction ||
    !creditPackage ||
    !productId ||
    typeof transactionId !== "string" ||
    !/^\d{1,64}$/.test(transactionId) ||
    !isProfileId(profileId) ||
    transaction.bundleId !== configuration.bundleId ||
    !isAppleStoreEnvironmentAllowed(transactionEnvironment, configuration) ||
    transactionEnvironment !== notificationEnvironment ||
    transaction.type !== "Consumable" ||
    transaction.quantity !== 1
  ) {
    return callbackJson({ error: "Invalid notification." }, 400);
  }

  const rpcClient = admin as unknown as AdPurchaseRpcClient;
  if (notificationType === "ONE_TIME_CHARGE") {
    if (transaction.revocationDate !== undefined) {
      return callbackJson({ error: "Invalid notification." }, 400);
    }
    const grant = await grantVerifiedAdCreditPurchase(rpcClient, {
      creditCents: creditPackage.creditCents,
      origin: "apple_iap",
      productId,
      profileId,
      providerTransactionId: transactionId,
    });
    if (!grant.ok) {
      console.error("Apple purchase notification grant failed.");
      return callbackJson({ error: "Notification processing failed." }, 500);
    }
  } else if (
    notificationType === "REFUND" ||
    notificationType === "REFUND_REVERSED" ||
    notificationType === "REVOKE"
  ) {
    if (
      notificationType !== "REFUND_REVERSED" &&
      typeof transaction.revocationDate !== "number"
    ) {
      return callbackJson({ error: "Invalid notification." }, 400);
    }
    const refundLifecycle = notificationType !== "REVOKE";
    const reconciliation = await reconcileVerifiedAdCreditPurchase(rpcClient, {
      action:
        notificationType === "REFUND_REVERSED"
          ? "refund_reverse"
          : "terminal_void",
      fullPurchase: true,
      origin: "apple_iap",
      productId,
      profileId,
      providerAmountCents: null,
      providerCurrency: null,
      providerEventId: `apple:${notificationUUID}`,
      providerLifecycleId: `${refundLifecycle ? "apple-refund" : "apple-revocation"}:${transactionId}`,
      providerPaidAmountCents: null,
      providerTransactionId: transactionId,
      purchaseCreditCents: creditPackage.creditCents,
      reason: refundLifecycle ? "refund" : "revocation",
      reconciliationCreditCents: creditPackage.creditCents,
    });
    if (!reconciliation.ok) {
      console.error("Apple terminal purchase notification reconciliation failed.");
      return callbackJson({ error: "Notification processing failed." }, 500);
    }
  }

  revalidatePath("/account");
  revalidatePath("/admin/payments");
  return callbackJson({ ok: true });
}
