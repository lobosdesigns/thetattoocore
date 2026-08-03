import "server-only";

import {
  Environment as AppleEnvironment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { JWT, OAuth2Client } from "google-auth-library";
import { createHash, createPrivateKey } from "node:crypto";
import {
  adCreditPackageForProductId,
  type AdCreditProductId,
} from "./credit-packages";

export type AdCreditOrigin =
  | "promo"
  | "stripe_web"
  | "apple_iap"
  | "google_play";

export type AdCreditReconciliationAction =
  | "hold"
  | "release"
  | "refund_reverse"
  | "terminal_void";

type VerifiedAdCreditPurchaseBase = {
  creditCents: number;
  productId: AdCreditProductId;
  providerTransactionId: string;
  profileId: string;
};

export type VerifiedAdCreditPurchase =
  | (VerifiedAdCreditPurchaseBase & {
      origin: "stripe_web";
      providerCurrency: "usd";
      providerPaidAmountCents: number;
    })
  | (VerifiedAdCreditPurchaseBase & {
      origin: "apple_iap" | "google_play";
      providerCurrency?: never;
      providerPaidAmountCents?: never;
    });

export type AdCreditReconciliationReason =
  | "cancellation"
  | "dispute"
  | "refund"
  | "revocation";

export type AdCreditPurchaseState =
  | "available"
  | "held"
  | "partially_voided"
  | "pending"
  | "terminal_void";

export type AdCreditReconciliationInput = {
  action: AdCreditReconciliationAction;
  fullPurchase: boolean;
  origin: Exclude<AdCreditOrigin, "promo">;
  productId: AdCreditProductId | null;
  profileId: string | null;
  providerAmountCents: number | null;
  providerCurrency: "usd" | null;
  providerEventId: string;
  providerLifecycleId: string;
  providerPaidAmountCents: number | null;
  providerTransactionId: string;
  purchaseCreditCents: number | null;
  reason: AdCreditReconciliationReason;
  reconciliationCreditCents: number | null;
};

export type AdPurchaseRpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

type Environment = Record<string, string | undefined>;
type JsonObject = Record<string, unknown>;
type RpcOutcome = {
  grant_id?: unknown;
  ledger_id?: unknown;
  outcome?: unknown;
  purchase_state?: unknown;
  source_id?: unknown;
};

type AppleSignedDataVerifier = Pick<
  SignedDataVerifier,
  "verifyAndDecodeNotification" | "verifyAndDecodeTransaction"
>;

type AppleVerifierFactory = (
  rootCertificates: Buffer[],
  enableOnlineChecks: boolean,
  environment: AppleEnvironment,
  bundleId: string,
  appAppleId?: number,
) => AppleSignedDataVerifier;

export type AppleStoreConfiguration = {
  allowSandbox: boolean;
  appAppleId: number;
  bundleId: string;
  productionVerifier: AppleSignedDataVerifier;
  sandboxVerifier: AppleSignedDataVerifier | null;
};

type GoogleServiceAccount = {
  clientEmail: string;
  privateKey: string;
  tokenUri: "https://oauth2.googleapis.com/token";
};

export type GooglePlayConfiguration = {
  allowTestPurchases: boolean;
  packageName: string;
  pubSubAudience: string | null;
  pubSubServiceAccountEmail: string | null;
  pubSubSubscription: string | null;
  serviceAccount: GoogleServiceAccount;
};

export type GooglePlayProductPurchase = {
  accessToken: string;
  consumptionState: string | null;
  isTestPurchase: boolean;
  obfuscatedExternalAccountId: string | null;
  orderId: string | null;
  productId: string | null;
  purchaseState: string | null;
  quantity: number | null;
  refundableQuantity: number | null;
};

const maxAdPurchaseBodyBytes = 16_384;
const maxProviderResponseBytes = 65_536;
const profileIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._~:+/=-]{0,511}$/;
const googlePurchaseTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._~:+/=-]{19,511}$/;
const googlePendingRefundTokenPattern =
  /^[A-Za-z0-9][A-Za-z0-9._~:+/=-]{0,2047}$/;
const googleAccessTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._~+/=-]{0,4095}$/;
const postgrestOperatorPattern =
  /^(?:not\.)?(?:is|eq|neq|gt|gte|lt|lte|like|ilike|in|cs|cd|ov|sl|sr|nxr|nxl|adj)\./i;
const compactJwsPattern =
  /^[A-Za-z0-9_-]{16,8192}\.[A-Za-z0-9_-]{16,8192}\.[A-Za-z0-9_-]{80,512}$/;
const googlePlayScope = "https://www.googleapis.com/auth/androidpublisher";
const googleTokenUri = "https://oauth2.googleapis.com/token";
const googlePubSubAuthClient = new OAuth2Client();

export function isProfileId(value: unknown): value is string {
  return typeof value === "string" && profileIdPattern.test(value);
}

export function isProviderTransactionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !value.includes("://") &&
    !postgrestOperatorPattern.test(value) &&
    providerIdentifierPattern.test(value)
  );
}

export function cleanAppleSignedTransaction(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 5 ||
    value.length > maxAdPurchaseBodyBytes ||
    !compactJwsPattern.test(value)
  ) {
    return null;
  }

  return value;
}

export function cleanGooglePurchaseToken(value: unknown) {
  return typeof value === "string" &&
    !value.includes("://") &&
    googlePurchaseTokenPattern.test(value)
    ? value
    : null;
}

export function cleanGooglePendingRefundToken(value: unknown) {
  return typeof value === "string" &&
    !value.includes("://") &&
    googlePendingRefundTokenPattern.test(value)
    ? value
    : null;
}

export async function googlePendingRefundReviewAuditKey(
  messageIdValue: unknown,
  pendingRefundTokenValue: unknown,
) {
  const messageId =
    typeof messageIdValue === "string" && /^\d{1,128}$/.test(messageIdValue)
      ? messageIdValue
      : null;
  const pendingRefundToken = cleanGooglePendingRefundToken(
    pendingRefundTokenValue,
  );
  if (!messageId || !pendingRefundToken) return null;

  const bytes = new TextEncoder().encode(
    `ttc-google-play-refund-review\0${messageId}\0${pendingRefundToken}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `google-play-refund-review:v1:${hex}`;
}

function isJsonContentType(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  return mediaType === "application/json" || mediaType?.endsWith("+json") === true;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function readBoundedJsonObject(
  request: Request,
  allowedKeys: ReadonlySet<string>,
) {
  if (!isJsonContentType(request)) {
    return { ok: false as const, status: 415 as const };
  }
  const contentEncoding = request.headers.get("content-encoding");
  if (
    contentEncoding !== null &&
    contentEncoding.trim().toLowerCase() !== "identity"
  ) {
    return { ok: false as const, status: 415 as const };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { ok: false as const, status: 400 as const };
    }

    if (Number(contentLength) > maxAdPurchaseBodyBytes) {
      return { ok: false as const, status: 413 as const };
    }
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > maxAdPurchaseBodyBytes) {
          await reader.cancel();
          return { ok: false as const, status: 413 as const };
        }
        chunks.push(value);
      }
    } catch {
      try {
        await reader.cancel();
      } catch {
        // The stream is already failed or canceled.
      }
      return { ok: false as const, status: 400 as const };
    }
  }

  try {
    const bodyBytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes);
    const value: unknown = JSON.parse(rawBody);
    if (
      !isJsonObject(value) ||
      Object.keys(value).some((key) => !allowedKeys.has(key))
    ) {
      return { ok: false as const, status: 400 as const };
    }

    return { ok: true as const, value };
  } catch {
    return { ok: false as const, status: 400 as const };
  }
}

function rpcOutcomeRow(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  return isJsonObject(row) ? (row as RpcOutcome) : null;
}

export async function grantVerifiedAdCreditPurchase(
  client: AdPurchaseRpcClient,
  purchase: VerifiedAdCreditPurchase,
) {
  const creditPackage = adCreditPackageForProductId(purchase.productId);
  const providerPaidAmountCents =
    purchase.origin === "stripe_web"
      ? purchase.providerPaidAmountCents
      : null;
  const providerCurrency =
    purchase.origin === "stripe_web" ? purchase.providerCurrency : null;
  if (
    !creditPackage ||
    purchase.creditCents !== creditPackage.creditCents ||
    !["stripe_web", "apple_iap", "google_play"].includes(purchase.origin) ||
    !isProfileId(purchase.profileId) ||
    !isProviderTransactionId(purchase.providerTransactionId) ||
    (purchase.origin === "stripe_web" &&
      (providerCurrency !== "usd" ||
        !Number.isSafeInteger(providerPaidAmountCents) ||
        providerPaidAmountCents !== creditPackage.webPriceCents)) ||
    (purchase.origin !== "stripe_web" &&
      (purchase.providerCurrency != null ||
        purchase.providerPaidAmountCents != null))
  ) {
    return { ok: false as const, reason: "invalid_purchase" as const };
  }

  const { data, error } = await client.rpc("grant_verified_ad_credit_purchase", {
    p_credit_cents: creditPackage.creditCents,
    p_credit_origin: purchase.origin,
    p_product_id: purchase.productId,
    p_profile_id: purchase.profileId.toLowerCase(),
    p_provider_currency: providerCurrency,
    p_provider_paid_amount_cents: providerPaidAmountCents,
    p_provider_transaction_id: purchase.providerTransactionId,
  });
  const row = rpcOutcomeRow(data);

  if (
    error ||
    !row ||
    (row.outcome !== "granted" && row.outcome !== "duplicate") ||
    !isProfileId(row.ledger_id)
  ) {
    return { ok: false as const, reason: "grant_failed" as const };
  }

  return {
    grantId: row.ledger_id.toLowerCase(),
    ok: true as const,
    outcome: row.outcome,
  };
}

export async function confirmVerifiedAdCreditPurchase(
  client: AdPurchaseRpcClient,
  purchase: VerifiedAdCreditPurchase & { grantId: string },
) {
  const creditPackage = adCreditPackageForProductId(purchase.productId);
  if (
    !creditPackage ||
    purchase.creditCents !== creditPackage.creditCents ||
    purchase.origin !== "apple_iap" ||
    !isProfileId(purchase.grantId) ||
    !isProfileId(purchase.profileId) ||
    !isProviderTransactionId(purchase.providerTransactionId)
  ) {
    return { ok: false as const, reason: "invalid_confirmation" as const };
  }

  const grantId = purchase.grantId.toLowerCase();
  const { data, error } = await client.rpc(
    "confirm_verified_ad_credit_purchase",
    {
      p_credit_origin: purchase.origin,
      p_grant_id: grantId,
      p_product_id: purchase.productId,
      p_profile_id: purchase.profileId.toLowerCase(),
      p_provider_transaction_id: purchase.providerTransactionId,
    },
  );
  const row = rpcOutcomeRow(data);

  if (error || !row || row.grant_id !== grantId) {
    return { ok: false as const, reason: "confirmation_failed" as const };
  }

  return { grantId, ok: true as const };
}

export async function reconcileVerifiedAdCreditPurchase(
  client: AdPurchaseRpcClient,
  input: AdCreditReconciliationInput,
) {
  const creditPackage = input.productId
    ? adCreditPackageForProductId(input.productId)
    : null;
  const hasKnownPurchase =
    creditPackage !== null &&
    input.purchaseCreditCents === creditPackage.creditCents &&
    input.reconciliationCreditCents === creditPackage.creditCents;
  const hasKnownProfile =
    input.profileId === null || isProfileId(input.profileId);
  const actionMatchesReason =
    ((input.action === "hold" || input.action === "release") &&
      input.origin === "stripe_web" &&
      input.reason === "dispute") ||
    (input.action === "refund_reverse" &&
      input.origin === "apple_iap" &&
      input.reason === "refund") ||
    (input.action === "terminal_void" &&
      ((input.origin === "stripe_web" &&
        (input.reason === "dispute" || input.reason === "refund")) ||
        (input.origin === "apple_iap" &&
          (input.reason === "refund" || input.reason === "revocation")) ||
        (input.origin === "google_play" &&
          (input.reason === "cancellation" ||
            input.reason === "refund" ||
            input.reason === "revocation"))));
  const stripeAmountsValid =
    input.origin === "stripe_web" &&
    creditPackage !== null &&
    input.profileId !== null &&
    isProfileId(input.profileId) &&
    input.fullPurchase === false &&
    input.purchaseCreditCents === creditPackage.creditCents &&
    input.providerCurrency === "usd" &&
    Number.isSafeInteger(input.providerPaidAmountCents) &&
    input.providerPaidAmountCents === creditPackage.webPriceCents &&
    Number.isSafeInteger(input.providerAmountCents) &&
    input.providerAmountCents! > 0 &&
    input.providerAmountCents! <= input.providerPaidAmountCents! &&
    input.reconciliationCreditCents === input.providerAmountCents;
  const appleAmountsValid =
    input.origin === "apple_iap" &&
    input.fullPurchase === true &&
    input.profileId !== null &&
    hasKnownProfile &&
    hasKnownPurchase &&
    input.providerPaidAmountCents === null &&
    input.providerAmountCents === null &&
    input.providerCurrency === null;
  const googleAmountsValid =
    input.origin === "google_play" &&
    input.fullPurchase === true &&
    input.providerPaidAmountCents === null &&
    input.providerAmountCents === null &&
    input.providerCurrency === null &&
    ((input.productId === null &&
      input.profileId === null &&
      input.purchaseCreditCents === null &&
      input.reconciliationCreditCents === null) ||
      (hasKnownPurchase && hasKnownProfile));

  if (
    !["hold", "release", "refund_reverse", "terminal_void"].includes(
      input.action,
    ) ||
    !["stripe_web", "apple_iap", "google_play"].includes(input.origin) ||
    !isProviderTransactionId(input.providerEventId) ||
    !isProviderTransactionId(input.providerLifecycleId) ||
    !isProviderTransactionId(input.providerTransactionId) ||
    !actionMatchesReason ||
    (!stripeAmountsValid && !appleAmountsValid && !googleAmountsValid)
  ) {
    return { ok: false as const, reason: "invalid_reconciliation" as const };
  }

  const { data, error } = await client.rpc(
    "reconcile_verified_ad_credit_purchase",
    {
      p_action: input.action,
      p_credit_origin: input.origin,
      p_full_purchase: input.fullPurchase,
      p_product_id: input.productId,
      p_profile_id: input.profileId?.toLowerCase() ?? null,
      p_provider_currency: input.providerCurrency,
      p_provider_event_amount_cents: input.providerAmountCents,
      p_provider_event_id: input.providerEventId,
      p_provider_lifecycle_id: input.providerLifecycleId,
      p_provider_paid_amount_cents: input.providerPaidAmountCents,
      p_provider_transaction_id: input.providerTransactionId,
      p_purchase_credit_cents: input.purchaseCreditCents,
      p_reason: input.reason,
      p_reconciliation_credit_cents: input.reconciliationCreditCents,
    },
  );
  const row = rpcOutcomeRow(data);

  if (
    error ||
    !row ||
    ![
      "duplicate",
      "held",
      "partially_voided",
      "refund_reversed",
      "released",
      "stale",
      "terminal_voided",
    ].includes(String(row.outcome)) ||
    ![
      "available",
      "held",
      "partially_voided",
      "pending",
      "terminal_void",
    ].includes(String(row.purchase_state)) ||
    !isProfileId(row.source_id) ||
    (row.ledger_id !== null && !isProfileId(row.ledger_id))
  ) {
    return { ok: false as const, reason: "reconciliation_failed" as const };
  }

  return {
    grantId:
      typeof row.ledger_id === "string" ? row.ledger_id.toLowerCase() : null,
    ok: true as const,
    outcome: row.outcome as
      | "duplicate"
      | "held"
      | "partially_voided"
      | "refund_reversed"
      | "released"
      | "stale"
      | "terminal_voided",
    purchaseState: row.purchase_state as AdCreditPurchaseState,
    sourceId: row.source_id.toLowerCase(),
  };
}

export async function resolveGoogleAdPurchaseProfile(
  client: AdPurchaseRpcClient,
  obfuscatedAccountId: string,
) {
  if (!/^[0-9a-f]{64}$/.test(obfuscatedAccountId)) return null;

  const { data, error } = await client.rpc("resolve_google_ad_purchase_profile", {
    p_obfuscated_account_id: obfuscatedAccountId,
  });
  const profileId = Array.isArray(data) ? data[0] : data;

  return !error && isProfileId(profileId) ? profileId.toLowerCase() : null;
}

function parseCertificatePem(value: string) {
  const normalized = value.replaceAll("\\n", "\n");
  const matches = normalized.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
  );

  if (!matches?.length || matches.length > 8) return null;

  try {
    return matches.map((certificate) => {
      const encoded = certificate
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\s/g, "");
      if (
        encoded.length < 100 ||
        encoded.length > 24_000 ||
        encoded.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
      ) {
        throw new Error("Invalid certificate encoding.");
      }

      const der = Buffer.from(encoded, "base64");
      if (
        der.byteLength < 64 ||
        der.byteLength > 16_384 ||
        der.toString("base64") !== encoded
      ) {
        throw new Error("Invalid certificate data.");
      }
      return der;
    });
  } catch {
    return null;
  }
}

export function appleStoreConfiguration(
  environment: Environment = process.env,
  verifierFactory: AppleVerifierFactory = (...args) =>
    new SignedDataVerifier(...args),
): AppleStoreConfiguration | null {
  const bundleId = environment.APPLE_APP_STORE_BUNDLE_ID?.trim();
  const legacyEnvironment = environment.APPLE_APP_STORE_ENVIRONMENT;
  const sandboxControl = environment.APPLE_APP_STORE_ALLOW_SANDBOX;
  const allowSandbox = sandboxControl === "true";
  const rootPem = environment.APPLE_APP_STORE_ROOT_CA_PEM;
  const appAppleIdText = environment.APPLE_APP_STORE_APP_ID?.trim();
  const appAppleId = appAppleIdText && /^\d{1,16}$/.test(appAppleIdText)
    ? Number(appAppleIdText)
    : null;
  const rootCertificates = rootPem ? parseCertificatePem(rootPem) : null;

  if (
    !bundleId ||
    bundleId.length > 200 ||
    !/^[A-Za-z0-9.-]+$/.test(bundleId) ||
    (legacyEnvironment !== undefined && legacyEnvironment !== "Production") ||
    (sandboxControl !== undefined &&
      sandboxControl !== "false" &&
      sandboxControl !== "true") ||
    !rootCertificates ||
    appAppleId === null ||
    !Number.isSafeInteger(appAppleId) ||
    appAppleId <= 0
  ) {
    return null;
  }

  try {
    const productionVerifier = verifierFactory(
      rootCertificates,
      true,
      AppleEnvironment.PRODUCTION,
      bundleId,
      appAppleId,
    );
    const sandboxVerifier = allowSandbox
      ? verifierFactory(
          rootCertificates,
          true,
          AppleEnvironment.SANDBOX,
          bundleId,
        )
      : null;

    return {
      allowSandbox,
      appAppleId,
      bundleId,
      productionVerifier,
      sandboxVerifier,
    };
  } catch {
    return null;
  }
}

export function isAppleStoreEnvironmentAllowed(
  value: unknown,
  configuration: AppleStoreConfiguration,
): value is "Production" | "Sandbox" {
  return (
    value === AppleEnvironment.PRODUCTION ||
    (configuration.allowSandbox && value === AppleEnvironment.SANDBOX)
  );
}

async function verifyWithAppleStoreVerifiers<T>(
  configuration: AppleStoreConfiguration,
  verify: (verifier: AppleSignedDataVerifier) => Promise<T>,
) {
  try {
    return await verify(configuration.productionVerifier);
  } catch {
    if (!configuration.allowSandbox || !configuration.sandboxVerifier) {
      return null;
    }
  }

  try {
    return await verify(configuration.sandboxVerifier);
  } catch {
    return null;
  }
}

export async function verifyAppleSignedTransaction(
  signedData: string,
  configuration: AppleStoreConfiguration,
): Promise<JWSTransactionDecodedPayload | null> {
  const cleaned = cleanAppleSignedTransaction(signedData);
  if (!cleaned) return null;

  return verifyWithAppleStoreVerifiers(configuration, (verifier) =>
    verifier.verifyAndDecodeTransaction(cleaned),
  );
}

export async function verifyAppleSignedNotification(
  signedData: string,
  configuration: AppleStoreConfiguration,
): Promise<ResponseBodyV2DecodedPayload | null> {
  const cleaned = cleanAppleSignedTransaction(signedData);
  if (!cleaned) return null;

  return verifyWithAppleStoreVerifiers(configuration, (verifier) =>
    verifier.verifyAndDecodeNotification(cleaned),
  );
}

function parsedServiceAccount(value: string | undefined) {
  if (!value || value.length > 20_000) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isJsonObject(parsed)) return null;
    const clientEmail = parsed.client_email;
    const privateKey = parsed.private_key;
    const tokenUri = parsed.token_uri;
    if (
      typeof clientEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(clientEmail) ||
      typeof privateKey !== "string" ||
      privateKey.length > 10_000 ||
      !privateKey.includes("BEGIN PRIVATE KEY") ||
      tokenUri !== googleTokenUri
    ) {
      return null;
    }

    if (createPrivateKey(privateKey).asymmetricKeyType !== "rsa") return null;

    return { clientEmail, privateKey, tokenUri } as GoogleServiceAccount;
  } catch {
    return null;
  }
}

export function googlePlayConfiguration(
  environment: Environment = process.env,
): GooglePlayConfiguration | null {
  const packageName = environment.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  const serviceAccount = parsedServiceAccount(
    environment.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
  );
  const pubSubAudience = environment.GOOGLE_PLAY_PUBSUB_AUDIENCE?.trim() || null;
  const pubSubServiceAccountEmail =
    environment.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim() || null;
  const pubSubSubscription =
    environment.GOOGLE_PLAY_PUBSUB_SUBSCRIPTION?.trim() || null;

  if (
    !packageName ||
    packageName.length > 200 ||
    !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName) ||
    !serviceAccount
  ) {
    return null;
  }

  return {
    allowTestPurchases:
      environment.GOOGLE_PLAY_ALLOW_TEST_PURCHASES === "true",
    packageName,
    pubSubAudience,
    pubSubServiceAccountEmail,
    pubSubSubscription,
    serviceAccount,
  };
}

async function readProviderJson(response: Response) {
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maxProviderResponseBytes) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(body);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function googleAccessToken(configuration: GooglePlayConfiguration) {
  try {
    const client = new JWT({
      email: configuration.serviceAccount.clientEmail,
      key: configuration.serviceAccount.privateKey,
      scopes: [googlePlayScope],
    });
    const credentials = await client.authorize();
    const accessToken = credentials.access_token;

    return typeof accessToken === "string" && accessToken.length <= 4096
      ? accessToken
      : null;
  } catch {
    return null;
  }
}

export function googlePlayAccountId(profileId: string) {
  return isProfileId(profileId)
    ? createHash("sha256").update(profileId.toLowerCase()).digest("hex")
    : null;
}

export async function verifyGooglePlayProductPurchase(
  purchaseToken: string,
  configuration: GooglePlayConfiguration,
): Promise<GooglePlayProductPurchase | null> {
  try {
    const cleanedToken = cleanGooglePurchaseToken(purchaseToken);
    if (!cleanedToken) return null;
    const accessToken = await googleAccessToken(configuration);
    if (!accessToken) return null;
    const endpoint =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(configuration.packageName)}/purchases/productsv2/tokens/` +
      encodeURIComponent(cleanedToken);
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await readProviderJson(response);
    if (!response.ok || !payload) return null;

    const lineItems = payload.productLineItem;
    const lineItem = Array.isArray(lineItems) && lineItems.length === 1
      ? lineItems[0]
      : null;
    if (!isJsonObject(lineItem)) return null;
    const offer = isJsonObject(lineItem.productOfferDetails)
      ? lineItem.productOfferDetails
      : null;
    const state = isJsonObject(payload.purchaseStateContext)
      ? payload.purchaseStateContext.purchaseState
      : null;

    return {
      accessToken,
      consumptionState:
        typeof offer?.consumptionState === "string" ? offer.consumptionState : null,
      isTestPurchase: isJsonObject(payload.testPurchaseContext),
      obfuscatedExternalAccountId:
        typeof payload.obfuscatedExternalAccountId === "string"
          ? payload.obfuscatedExternalAccountId
          : null,
      orderId: typeof payload.orderId === "string" ? payload.orderId : null,
      productId: typeof lineItem.productId === "string" ? lineItem.productId : null,
      purchaseState: typeof state === "string" ? state : null,
      quantity: typeof offer?.quantity === "number" ? offer.quantity : null,
      refundableQuantity:
        typeof offer?.refundableQuantity === "number"
          ? offer.refundableQuantity
          : null,
    };
  } catch {
    return null;
  }
}

export async function consumeGooglePlayProduct(input: {
  accessToken: string;
  configuration: GooglePlayConfiguration;
  productId: AdCreditProductId;
  purchaseToken: string;
}) {
  try {
    const purchaseToken = cleanGooglePurchaseToken(input.purchaseToken);
    if (!purchaseToken || !adCreditPackageForProductId(input.productId)) return false;
    const endpoint =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(input.configuration.packageName)}/purchases/products/` +
      `${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${input.accessToken}` },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function reviewGooglePendingRefund(input: {
  accessToken?: string;
  configuration: GooglePlayConfiguration;
  orderId: string;
  pendingRefundToken: string;
}) {
  try {
    const pendingRefundToken = cleanGooglePendingRefundToken(
      input.pendingRefundToken,
    );
    if (
      !pendingRefundToken ||
      !isProviderTransactionId(input.orderId) ||
      input.orderId.length > 200
    ) {
      return false;
    }

    const accessToken =
      input.accessToken ?? (await googleAccessToken(input.configuration));
    if (
      typeof accessToken !== "string" ||
      !googleAccessTokenPattern.test(accessToken)
    ) {
      return false;
    }

    const endpoint =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(input.configuration.packageName)}/orders/` +
      `${encodeURIComponent(input.orderId)}:reviewrefund`;
    const response = await fetch(endpoint, {
      body: JSON.stringify({
        pendingRefundToken,
        refundPreference: "NEUTRAL",
        sampleContentProvided: false,
      }),
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function verifyGooglePubSubPush(
  request: Request,
  configuration: GooglePlayConfiguration,
  verifier: Pick<OAuth2Client, "verifyIdToken"> = googlePubSubAuthClient,
) {
  if (
    !configuration.pubSubAudience ||
    !configuration.pubSubServiceAccountEmail ||
    !configuration.pubSubSubscription
  ) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
    authorization,
  );
  if (!match || match[1].length > 8_192) return false;
  try {
    const ticket = await verifier.verifyIdToken({
      audience: configuration.pubSubAudience,
      idToken: match[1],
    });
    const claims = ticket.getPayload();
    const now = Math.floor(Date.now() / 1000);

    return Boolean(
      claims &&
        claims.aud === configuration.pubSubAudience &&
        claims.email === configuration.pubSubServiceAccountEmail &&
        claims.email_verified === true &&
        (claims.iss === "accounts.google.com" ||
          claims.iss === "https://accounts.google.com") &&
        Number.isSafeInteger(claims.exp) &&
        claims.exp > now &&
        Number.isSafeInteger(claims.iat) &&
        claims.iat <= now + 300,
    );
  } catch {
    return false;
  }
}
