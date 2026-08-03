type AdCreditProductId =
  | "ttc.adcredit.2500"
  | "ttc.adcredit.5000"
  | "ttc.adcredit.10000";

export type AdCheckoutIntent =
  | {
      kind: "campaign";
      campaignId: string;
      returnTo: string | null;
    }
  | {
      kind: "purchase";
      productId: AdCreditProductId;
      returnTo: string | null;
    };

const allowedFormKeys = new Set(["campaign_id", "product_id", "return_to"]);
const productIds = new Set<AdCreditProductId>([
  "ttc.adcredit.2500",
  "ttc.adcredit.5000",
  "ttc.adcredit.10000",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxAdCheckoutBodyBytes = 4096;
const urlEncodedContentTypePattern =
  /^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i;

function isProductId(value: string | null): value is AdCreditProductId {
  return productIds.has(value as AdCreditProductId);
}

function singleTextValue(formData: FormData, key: string) {
  const values = formData.getAll(key);
  if (values.length > 1) return { ok: false as const, value: null };
  if (values.length === 0) return { ok: true as const, value: null };

  const value = values[0];
  return typeof value === "string"
    ? { ok: true as const, value: value.trim() }
    : { ok: false as const, value: null };
}

export function safeAdCheckoutReturnPath(value: unknown) {
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (
    !text ||
    text.length > 240 ||
    !text.startsWith("/") ||
    text.startsWith("//") ||
    /[\u0000-\u001f\u007f\\]/.test(text)
  ) {
    return null;
  }

  return text;
}

export function adCheckoutBodyAllowed(contentLength: unknown) {
  if (contentLength === null || contentLength === undefined) return true;
  if (typeof contentLength !== "string" || !/^\d{1,10}$/.test(contentLength)) {
    return false;
  }

  return Number(contentLength) <= maxAdCheckoutBodyBytes;
}

export async function readBoundedAdCheckoutForm(request: Request) {
  const contentEncoding = request.headers.get("content-encoding");
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (
    !adCheckoutBodyAllowed(request.headers.get("content-length")) ||
    !urlEncodedContentTypePattern.test(contentType) ||
    (contentEncoding !== null && contentEncoding.trim().toLowerCase() !== "identity") ||
    request.bodyUsed ||
    !request.body
  ) {
    return null;
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxAdCheckoutBodyBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) return null;

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let encodedForm: string;
  try {
    encodedForm = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }

  const formData = new FormData();
  for (const [key, value] of new URLSearchParams(encodedForm)) {
    formData.append(key, value);
  }
  return formData;
}

export function parseAdCheckoutForm(formData: FormData): AdCheckoutIntent | null {
  if (
    Array.from(formData.keys()).some((key) => !allowedFormKeys.has(key))
  ) {
    return null;
  }

  const campaign = singleTextValue(formData, "campaign_id");
  const product = singleTextValue(formData, "product_id");
  const returnPath = singleTextValue(formData, "return_to");
  if (!campaign.ok || !product.ok || !returnPath.ok) return null;

  const hasCampaign = Boolean(campaign.value);
  const hasProduct = Boolean(product.value);
  if (hasCampaign === hasProduct) return null;

  const returnTo = safeAdCheckoutReturnPath(returnPath.value);
  if (returnPath.value !== null && returnTo === null) return null;

  if (hasCampaign) {
    return uuidPattern.test(campaign.value ?? "")
      ? {
          campaignId: campaign.value as string,
          kind: "campaign",
          returnTo,
        }
      : null;
  }

  if (!isProductId(product.value)) return null;
  return {
    kind: "purchase",
    productId: product.value,
    returnTo,
  };
}
