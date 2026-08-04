"use client";

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdPurchaseSurface } from "@/lib/commerce-launch";

type ProductId =
  | "ttc.adcredit.2500"
  | "ttc.adcredit.5000"
  | "ttc.adcredit.10000";

type NativeProduct = {
  displayName?: unknown;
  displayPrice?: unknown;
  formattedPrice?: unknown;
  name?: unknown;
  productId?: unknown;
  title?: unknown;
};

type AppleTransaction = {
  productId?: unknown;
  signedTransactionJWS?: unknown;
  transactionId?: unknown;
};

type GooglePurchase = {
  productId?: unknown;
  purchaseState?: unknown;
  purchaseToken?: unknown;
};

type AdPurchasePlugin = {
  addListener: (
    eventName: "purchasesUpdated" | "transactionUpdated",
    listener: (event: unknown) => void,
  ) => Promise<PluginListenerHandle>;
  clearAccount: (options: { profileId: string }) => Promise<unknown>;
  configureAccount: (options: { profileId: string }) => Promise<unknown>;
  finishTransaction: (options: {
    grantId: string;
    signedTransactionJWS: string;
  }) => Promise<unknown>;
  getProducts: () => Promise<{ products?: unknown }>;
  purchase: (options: {
    appAccountToken?: string;
    productId: ProductId;
    profileId?: string;
  }) => Promise<unknown>;
  queryPurchases: () => Promise<{ purchases?: unknown }>;
  recoverTransactions: () => Promise<{ transactions?: unknown }>;
};

const plugin = registerPlugin<AdPurchasePlugin>("TtcAdPurchases");
const productIds: ProductId[] = [
  "ttc.adcredit.2500",
  "ttc.adcredit.5000",
  "ttc.adcredit.10000",
];
const productLabels: Record<ProductId, string> = {
  "ttc.adcredit.2500": "$25 credit",
  "ttc.adcredit.5000": "$50 credit",
  "ttc.adcredit.10000": "$100 credit",
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isProductId(value: unknown): value is ProductId {
  return typeof value === "string" && productIds.includes(value as ProductId);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function objectArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(objectValue).filter((item) => item !== null)
    : [];
}

function nativeProduct(value: Record<string, unknown>): NativeProduct | null {
  return isProductId(value.productId) ? value : null;
}

function productPrice(product: NativeProduct) {
  if (typeof product.formattedPrice === "string") return product.formattedPrice;
  if (typeof product.displayPrice === "string") return product.displayPrice;
  return "";
}

function productName(product: NativeProduct, productId: ProductId) {
  for (const value of [product.displayName, product.name, product.title]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return productLabels[productId];
}

async function postPurchase(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  const result = objectValue(await response.json().catch(() => null));
  if (!response.ok || result?.ok !== true) {
    throw new Error("Purchase verification failed.");
  }
  return result;
}

export function AdCreditPurchaseOptions({
  enabled,
  profileId,
  surface,
}: {
  enabled: boolean;
  profileId: string;
  surface: AdPurchaseSurface;
}) {
  const [message, setMessage] = useState("");
  const [nativeProducts, setNativeProducts] = useState<NativeProduct[]>([]);
  const [pendingProduct, setPendingProduct] = useState<ProductId | null>(null);
  const [retryApplePurchase, setRetryApplePurchase] = useState(false);
  const [retryingApplePurchase, setRetryingApplePurchase] = useState(false);
  const processing = useRef(new Set<string>());

  const verifyAppleTransaction = useCallback(
    async (value: unknown) => {
      const transaction = objectValue(value) as AppleTransaction | null;
      if (
        !transaction ||
        !isProductId(transaction.productId) ||
        typeof transaction.signedTransactionJWS !== "string" ||
        typeof transaction.transactionId !== "string"
      ) {
        return;
      }

      const key = `ios:${transaction.transactionId}`;
      if (processing.current.has(key)) return;
      processing.current.add(key);

      try {
        const grant = await postPurchase("/api/ads/purchases/apple", {
          signedTransaction: transaction.signedTransactionJWS,
        });
        if (typeof grant.grantId !== "string" || !uuidPattern.test(grant.grantId)) {
          throw new Error("Purchase grant verification failed.");
        }
        await plugin.finishTransaction({
          grantId: grant.grantId,
          signedTransactionJWS: transaction.signedTransactionJWS,
        });
        setRetryApplePurchase(false);
        setMessage("Ad credit added.");
      } catch {
        setRetryApplePurchase(true);
        setMessage("Purchase verification needs another attempt.");
      } finally {
        processing.current.delete(key);
      }
    },
    [],
  );

  const verifyGooglePurchase = useCallback(async (value: unknown) => {
    const purchase = objectValue(value) as GooglePurchase | null;
    if (
      !purchase ||
      !isProductId(purchase.productId) ||
      purchase.purchaseState !== "purchased" ||
      typeof purchase.purchaseToken !== "string"
    ) {
      return;
    }

    const key = `android:${purchase.purchaseToken}`;
    if (processing.current.has(key)) return;
    processing.current.add(key);

    try {
      await postPurchase("/api/ads/purchases/google", {
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken,
      });
      setMessage("Ad credit added.");
    } catch {
      setMessage("Purchase verification needs another attempt.");
    } finally {
      processing.current.delete(key);
    }
  }, []);

  useEffect(() => {
    if (!enabled || surface === "web") return;

    let cancelled = false;
    const handles: PluginListenerHandle[] = [];

    async function retainHandle(handle: PluginListenerHandle) {
      if (cancelled) {
        await handle.remove();
      } else {
        handles.push(handle);
      }
    }

    async function setup() {
      if (surface === "ios") {
        await retainHandle(
          await plugin.addListener("transactionUpdated", (event) => {
            if (!cancelled) void verifyAppleTransaction(event);
          }),
        );
        if (cancelled) return;
        await plugin.configureAccount({ profileId });
        if (cancelled) {
          await plugin.clearAccount({ profileId });
          return;
        }
      } else {
        await retainHandle(
          await plugin.addListener("purchasesUpdated", (event) => {
            if (cancelled) return;
            const payload = objectValue(event);
            for (const purchase of objectArray(payload?.purchases)) {
              void verifyGooglePurchase(purchase);
            }
          }),
        );
      }

      const catalog = await plugin.getProducts();
      if (cancelled) return;
      const products = objectArray(catalog.products)
        .map(nativeProduct)
        .filter((product) => product !== null);
      setNativeProducts(products);

      if (surface === "ios") {
        const recovered = await plugin.recoverTransactions();
        for (const transaction of objectArray(recovered.transactions)) {
          if (cancelled) return;
          await verifyAppleTransaction(transaction);
        }
      } else {
        const recovered = await plugin.queryPurchases();
        for (const purchase of objectArray(recovered.purchases)) {
          if (cancelled) return;
          await verifyGooglePurchase(purchase);
        }
      }
    }

    void setup().catch(() => {
      if (!cancelled) setMessage("Purchase options are temporarily unavailable.");
    });

    return () => {
      cancelled = true;
      for (const handle of handles) void handle.remove();
      if (surface === "ios") {
        void plugin.clearAccount({ profileId }).catch(() => undefined);
      }
    };
  }, [enabled, profileId, surface, verifyAppleTransaction, verifyGooglePurchase]);

  async function purchase(productId: ProductId) {
    setPendingProduct(productId);
    setMessage("");

    try {
      if (surface === "ios") {
        const transaction = await plugin.purchase({
          productId,
        });
        await verifyAppleTransaction(transaction);
      } else if (surface === "android") {
        const result = objectValue(
          await plugin.purchase({
            productId,
            profileId,
          }),
        );
        const purchases = objectArray(result?.purchases);
        if (!purchases.length) {
          setMessage("Purchase was not completed.");
        }
        for (const ownedPurchase of purchases) {
          await verifyGooglePurchase(ownedPurchase);
        }
      }
    } catch {
      setMessage("Purchase was not completed.");
    } finally {
      setPendingProduct(null);
    }
  }

  async function retryAppleVerification() {
    setRetryingApplePurchase(true);
    setMessage("");
    try {
      const recovered = await plugin.recoverTransactions();
      const transactions = objectArray(recovered.transactions);
      if (!transactions.length) {
        setRetryApplePurchase(false);
        setMessage("No pending purchase needs verification.");
        return;
      }
      for (const transaction of transactions) {
        await verifyAppleTransaction(transaction);
      }
    } catch {
      setMessage("Purchase verification needs another attempt.");
    } finally {
      setRetryingApplePurchase(false);
    }
  }

  if (!enabled) {
    return (
      <p className="mt-4 border-t border-[var(--card-rim)] pt-4 text-sm leading-6 text-[var(--muted)]">
        Ad credit purchases are not available yet.
      </p>
    );
  }

  if (surface === "web") {
    return (
      <div className="mt-4 border-t border-[var(--card-rim)] pt-4">
        <h3 className="text-sm font-bold">Add ad credit</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {productIds.map((productId) => (
            <form action="/api/ads/checkout" key={productId} method="post">
              <input name="product_id" type="hidden" value={productId} />
              <input
                name="return_to"
                type="hidden"
                value="/account#advertising-settings"
              />
              <button
                className="h-10 w-full rounded-md border border-[var(--foreground)] px-3 text-sm font-semibold"
                type="submit"
              >
                Add {productLabels[productId]}
              </button>
            </form>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--card-rim)] pt-4">
      <h3 className="text-sm font-bold">Add ad credit</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {nativeProducts.map((product) => {
          const productId = product.productId as ProductId;
          const price = productPrice(product);

          return (
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--foreground)] px-3 text-sm font-semibold disabled:opacity-60"
              disabled={pendingProduct !== null}
              key={productId}
              onClick={() => purchase(productId)}
              type="button"
            >
              {pendingProduct === productId ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {productName(product, productId)}{price ? ` - ${price}` : ""}
            </button>
          );
        })}
      </div>
      {surface === "ios" && retryApplePurchase ? (
        <button
          className="mt-3 h-10 rounded-md border border-[var(--foreground)] px-3 text-sm font-semibold disabled:opacity-60"
          disabled={retryingApplePurchase}
          onClick={() => void retryAppleVerification()}
          type="button"
        >
          {retryingApplePurchase ? "Retrying purchase" : "Retry purchase verification"}
        </button>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-[var(--muted-strong)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
