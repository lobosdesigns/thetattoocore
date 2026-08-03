import {
  adCreditPackageForProductId,
  isAdCreditProductId,
} from "./credit-packages";

type JsonObject = Record<string, unknown>;

const profileIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const paymentIntentPattern = /^pi_[A-Za-z0-9]{8,200}$/;
const chargePattern = /^ch_[A-Za-z0-9]{8,200}$/;
const disputePattern = /^dp_[A-Za-z0-9]{8,200}$/;
const disputeEvents = new Set([
  "charge.dispute.closed",
  "charge.dispute.created",
  "charge.dispute.funds_reinstated",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.updated",
]);
const disputeHoldStatuses = new Set([
  "lost",
  "needs_response",
  "under_review",
  "warning_needs_response",
  "warning_under_review",
]);
const disputeReleaseStatuses = new Set([
  "prevented",
  "warning_closed",
  "won",
]);

export function isStripePaymentIntentId(value: unknown): value is string {
  return typeof value === "string" && paymentIntentPattern.test(value);
}

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function exactInteger(value: unknown, expected: number) {
  return Number.isSafeInteger(value) && value === expected;
}

function proportionalCreditCents(
  providerAmountCents: number,
  providerPaidAmountCents: number,
  purchaseCreditCents: number,
) {
  const numerator = providerAmountCents * purchaseCreditCents;
  return Number.isSafeInteger(numerator) &&
    numerator % providerPaidAmountCents === 0
    ? numerator / providerPaidAmountCents
    : null;
}

function exactMetadata(value: unknown) {
  const metadata = objectValue(value);
  const productId = metadata?.ad_credit_product_id;
  const profileId = metadata?.profile_id;

  if (
    metadata?.payment_kind !== "ad_credit_purchase" ||
    !isAdCreditProductId(productId) ||
    typeof profileId !== "string" ||
    !profileIdPattern.test(profileId)
  ) {
    return null;
  }

  const creditPackage = adCreditPackageForProductId(productId);
  if (
    !creditPackage ||
    metadata.credit_cents !== String(creditPackage.creditCents)
  ) {
    return null;
  }

  return { creditPackage, productId, profileId };
}

export function stripeAdCreditGrantFromCheckout(value: unknown) {
  const session = objectValue(value);
  const identity = exactMetadata(session?.metadata);
  const totals = objectValue(session?.total_details);
  const paymentIntentId = session?.payment_intent;

  if (
    !identity ||
    session?.client_reference_id !== identity.profileId ||
    session?.currency !== "usd" ||
    session?.mode !== "payment" ||
    session?.payment_status !== "paid" ||
    session?.status !== "complete" ||
    !isStripePaymentIntentId(paymentIntentId) ||
    !exactInteger(session.amount_subtotal, identity.creditPackage.webPriceCents) ||
    !exactInteger(session.amount_total, identity.creditPackage.webPriceCents) ||
    !totals ||
    !exactInteger(totals.amount_discount, 0) ||
    !exactInteger(totals.amount_shipping, 0) ||
    !exactInteger(totals.amount_tax, 0)
  ) {
    return null;
  }

  return {
    creditCents: identity.creditPackage.creditCents,
    origin: "stripe_web" as const,
    productId: identity.productId,
    profileId: identity.profileId,
    providerCurrency: "usd" as const,
    providerPaidAmountCents: identity.creditPackage.webPriceCents,
    providerTransactionId: paymentIntentId,
  };
}

export function stripeAdCreditRefundFromCharge(value: unknown) {
  const charge = objectValue(value);
  const identity = exactMetadata(charge?.metadata);
  const paymentIntentId = charge?.payment_intent;
  const chargeId = charge?.id;
  const amountRefunded = charge?.amount_refunded;

  if (
    !identity ||
    typeof chargeId !== "string" ||
    !chargePattern.test(chargeId) ||
    charge?.currency !== "usd" ||
    !isStripePaymentIntentId(paymentIntentId) ||
    !exactInteger(charge.amount, identity.creditPackage.webPriceCents) ||
    !Number.isSafeInteger(amountRefunded) ||
    (amountRefunded as number) <= 0 ||
    (amountRefunded as number) > identity.creditPackage.webPriceCents
  ) {
    return null;
  }

  const fullyRefunded = amountRefunded === identity.creditPackage.webPriceCents;
  if (charge.refunded !== fullyRefunded) return null;
  const reconciliationCreditCents = proportionalCreditCents(
    amountRefunded as number,
    identity.creditPackage.webPriceCents,
    identity.creditPackage.creditCents,
  );
  if (!reconciliationCreditCents) return null;

  return {
    action: "terminal_void" as const,
    fullPurchase: false,
    kind: fullyRefunded ? ("full" as const) : ("partial" as const),
    origin: "stripe_web" as const,
    productId: identity.productId,
    profileId: identity.profileId,
    providerAmountCents: amountRefunded as number,
    providerCurrency: "usd" as const,
    providerLifecycleId: chargeId,
    providerPaidAmountCents: identity.creditPackage.webPriceCents,
    providerTransactionId: paymentIntentId,
    purchaseCreditCents: identity.creditPackage.creditCents,
    reason: "refund" as const,
    reconciliationCreditCents,
  };
}

export function stripeAdCreditDisputeAction(
  eventType: unknown,
  disputeStatus: unknown,
) {
  if (
    typeof eventType !== "string" ||
    !disputeEvents.has(eventType) ||
    typeof disputeStatus !== "string"
  ) {
    return null;
  }

  if (disputeStatus === "lost") return "terminal_void" as const;
  if (disputeReleaseStatuses.has(disputeStatus)) return "release" as const;

  return disputeHoldStatuses.has(disputeStatus) ? ("hold" as const) : null;
}

export function stripeAdCreditDisputeReconciliation(
  eventType: unknown,
  disputeValue: unknown,
  chargeValue: unknown,
) {
  const dispute = objectValue(disputeValue);
  const charge = objectValue(chargeValue);
  const identity = exactMetadata(charge?.metadata);
  const chargeId = charge?.id;
  const disputeId = dispute?.id;
  const paymentIntentId = charge?.payment_intent;
  const disputeCharge =
    typeof dispute?.charge === "string"
      ? dispute.charge
      : objectValue(dispute?.charge)?.id;
  const action = stripeAdCreditDisputeAction(eventType, dispute?.status);
  const providerAmountCents = dispute?.amount;

  if (
    !identity ||
    !action ||
    typeof chargeId !== "string" ||
    !chargePattern.test(chargeId) ||
    typeof disputeId !== "string" ||
    !disputePattern.test(disputeId) ||
    disputeCharge !== chargeId ||
    charge?.currency !== "usd" ||
    dispute?.currency !== "usd" ||
    !isStripePaymentIntentId(paymentIntentId) ||
    !exactInteger(charge.amount, identity.creditPackage.webPriceCents) ||
    !Number.isSafeInteger(providerAmountCents) ||
    (providerAmountCents as number) <= 0 ||
    (providerAmountCents as number) > identity.creditPackage.webPriceCents
  ) {
    return null;
  }

  const reconciliationCreditCents = proportionalCreditCents(
    providerAmountCents as number,
    identity.creditPackage.webPriceCents,
    identity.creditPackage.creditCents,
  );
  if (!reconciliationCreditCents) return null;

  return {
    action,
    fullPurchase: false,
    origin: "stripe_web" as const,
    productId: identity.productId,
    profileId: identity.profileId,
    providerAmountCents: providerAmountCents as number,
    providerCurrency: "usd" as const,
    providerLifecycleId: disputeId,
    providerPaidAmountCents: identity.creditPackage.webPriceCents,
    providerTransactionId: paymentIntentId,
    purchaseCreditCents: identity.creditPackage.creditCents,
    reason: "dispute" as const,
    reconciliationCreditCents,
  };
}
