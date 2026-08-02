import "server-only";

export const SELLER_CHECKOUT_TERMS_VERSION = "seller-checkout-v1";

const SELLER_CHECKOUT_FLAG = "STRIPE_MARKETPLACE_MERCH_CHECKOUT_ENABLED";
const SELLER_CHECKOUT_HOST = "buy.stripe.com";
const MAX_CHECKOUT_URL_LENGTH = 500;
const MAX_CHECKOUT_IDENTIFIER_LENGTH = 255;

export type SellerCheckoutUrlResult =
  | { ok: true; url: string }
  | { ok: false; code: "required" | "too_long" | "invalid" | "test_link" };

export type SellerCheckoutReadinessInput = {
  externalCheckoutUrl: unknown;
  fulfillmentNotes: string | null;
  inventoryQuantity: number;
  inventoryReserved: number;
  isOfficial: boolean;
  moderationStatus: string;
  returnPolicy: string | null;
  sellerCheckoutTermsAcceptedAt: string | null;
  sellerCheckoutTermsVersion: string | null;
  sellerVerified: boolean;
  shippingRequired: boolean;
  shipsFromCity: string | null;
  shipsFromRegion: string | null;
  status: string;
};

export type SellerCheckoutReadinessReason =
  | "disabled"
  | "official_product"
  | "seller_unverified"
  | "sold_out"
  | "missing_fulfillment"
  | "missing_terms"
  | "invalid_url"
  | "not_active"
  | "not_moderated";

export type SellerCheckoutReadiness =
  | { ready: true; reason: null; url: string }
  | { ready: false; reason: SellerCheckoutReadinessReason; url: null };

function failed(reason: SellerCheckoutReadinessReason): SellerCheckoutReadiness {
  return { ready: false, reason, url: null };
}

function hasMinimumText(value: string | null) {
  return typeof value === "string" && value.trim().length >= 10;
}

function hasNonEmptyText(value: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAcceptedCurrentTerms(input: SellerCheckoutReadinessInput) {
  return (
    input.sellerCheckoutTermsVersion === SELLER_CHECKOUT_TERMS_VERSION &&
    typeof input.sellerCheckoutTermsAcceptedAt === "string" &&
    !Number.isNaN(Date.parse(input.sellerCheckoutTermsAcceptedAt))
  );
}

export function validateSellerCheckoutUrl(
  value: unknown,
  options?: { allowTest?: boolean },
): SellerCheckoutUrlResult {
  if (value === null || value === undefined || value === "") {
    return { ok: false, code: "required" };
  }

  if (typeof value !== "string") {
    return { ok: false, code: "invalid" };
  }

  if (value.length > MAX_CHECKOUT_URL_LENGTH) {
    return { ok: false, code: "too_long" };
  }

  if (/\s|[\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, code: "invalid" };
  }

  if (value.includes("?") || value.includes("#")) {
    return { ok: false, code: "invalid" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, code: "invalid" };
  }

  const authority = /^[^:]+:\/\/([^/]+)/.exec(value)?.[1];
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== SELLER_CHECKOUT_HOST ||
    parsed.host !== SELLER_CHECKOUT_HOST ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    authority?.toLowerCase() !== SELLER_CHECKOUT_HOST
  ) {
    return { ok: false, code: "invalid" };
  }

  const pathMatch = /^\/([A-Za-z0-9_]+)$/.exec(parsed.pathname);
  if (!pathMatch) {
    return { ok: false, code: "invalid" };
  }

  const identifier = pathMatch[1];
  if (identifier.length > MAX_CHECKOUT_IDENTIFIER_LENGTH) {
    return { ok: false, code: "too_long" };
  }

  if (identifier.startsWith("test_") && options?.allowTest !== true) {
    return { ok: false, code: "test_link" };
  }

  return { ok: true, url: `https://${SELLER_CHECKOUT_HOST}/${identifier}` };
}

export function sellerCheckoutLinksEnabled(
  environment: Record<string, unknown> = process.env,
) {
  return environment[SELLER_CHECKOUT_FLAG] === "true";
}

export function sellerCheckoutSubmissionReadiness(
  input: SellerCheckoutReadinessInput,
): SellerCheckoutReadiness {
  if (input.isOfficial) return failed("official_product");
  if (!input.sellerVerified) return failed("seller_unverified");
  if (!(input.inventoryQuantity - input.inventoryReserved > 0)) {
    return failed("sold_out");
  }
  if (
    !hasMinimumText(input.fulfillmentNotes) ||
    !hasMinimumText(input.returnPolicy) ||
    (input.shippingRequired &&
      (!hasNonEmptyText(input.shipsFromCity) ||
        !hasNonEmptyText(input.shipsFromRegion)))
  ) {
    return failed("missing_fulfillment");
  }
  if (!hasAcceptedCurrentTerms(input)) return failed("missing_terms");

  const urlResult = validateSellerCheckoutUrl(input.externalCheckoutUrl);
  if (!urlResult.ok) return failed("invalid_url");

  return { ready: true, reason: null, url: urlResult.url };
}

export function sellerCheckoutPurchaseReadiness(
  input: SellerCheckoutReadinessInput,
  environment: Record<string, unknown> = process.env,
): SellerCheckoutReadiness {
  if (!sellerCheckoutLinksEnabled(environment)) return failed("disabled");

  const submission = sellerCheckoutSubmissionReadiness(input);
  if (!submission.ready) return submission;
  if (input.status !== "active") return failed("not_active");
  if (input.moderationStatus !== "active") return failed("not_moderated");

  return submission;
}
