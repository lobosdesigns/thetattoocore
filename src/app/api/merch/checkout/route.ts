import { NextResponse } from "next/server";
import { siteName, siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

type Product = {
  currency: string;
  description: string | null;
  id: string;
  inventory_quantity: number;
  inventory_reserved: number;
  price_cents: number;
  seller_id: string;
  sku: string | null;
  title: string;
};

type CheckoutSession = {
  id: string;
  url: string | null;
};

function calculatePlatformFeeCents(subtotalCents: number) {
  if (subtotalCents <= 0) return 0;

  return Math.ceil(subtotalCents * 0.02);
}

function cleanQuantity(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? "1"), 10);

  if (!Number.isFinite(parsed)) return 1;

  return Math.max(1, Math.min(10, parsed));
}

function redirectWithMessage(path: string, message: string) {
  return NextResponse.redirect(
    `${siteUrl}${path}?message=${encodeURIComponent(message)}`,
    { status: 303 },
  );
}

async function createCheckoutSession({
  buyerId,
  cancelUrl,
  orderId,
  platformFeeCents,
  product,
  quantity,
  subtotalCents,
  successUrl,
}: {
  buyerId: string;
  cancelUrl: string;
  orderId: string;
  platformFeeCents: number;
  product: Product;
  quantity: number;
  subtotalCents: number;
  successUrl: string;
}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe is not configured yet. Add the Stripe secret key before checkout.");
  }

  const body = new URLSearchParams({
    "allow_promotion_codes": "false",
    "billing_address_collection": "auto",
    "client_reference_id": orderId,
    "line_items[0][price_data][currency]": product.currency.toLowerCase(),
    "line_items[0][price_data][product_data][metadata][merch_product_id]":
      product.id,
    "line_items[0][price_data][product_data][metadata][seller_id]":
      product.seller_id,
    "line_items[0][price_data][product_data][name]": product.title,
    "line_items[0][price_data][unit_amount]": String(product.price_cents),
    "line_items[0][quantity]": String(quantity),
    "metadata[buyer_id]": buyerId,
    "metadata[merch_order_id]": orderId,
    "metadata[merch_product_id]": product.id,
    "metadata[merch_subtotal_cents]": String(subtotalCents),
    "metadata[platform_fee_cents]": String(platformFeeCents),
    "metadata[seller_id]": product.seller_id,
    "mode": "payment",
    "payment_intent_data[metadata][buyer_id]": buyerId,
    "payment_intent_data[metadata][merch_order_id]": orderId,
    "payment_intent_data[metadata][merch_product_id]": product.id,
    "payment_intent_data[metadata][merch_subtotal_cents]": String(subtotalCents),
    "payment_intent_data[metadata][platform_fee_cents]": String(platformFeeCents),
    "payment_intent_data[metadata][seller_id]": product.seller_id,
    "shipping_address_collection[allowed_countries][0]": "US",
    "shipping_address_collection[allowed_countries][1]": "CA",
    "submit_type": "pay",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
  });

  if (product.description) {
    body.set(
      "line_items[0][price_data][product_data][description]",
      product.description.slice(0, 500),
    );
  }

  if (platformFeeCents > 0) {
    body.set("line_items[1][price_data][currency]", product.currency.toLowerCase());
    body.set("line_items[1][price_data][product_data][name]", `${siteName} platform fee`);
    body.set(
      "line_items[1][price_data][product_data][description]",
      "Transparent 2% TTC platform fee for test-mode Merch checkout.",
    );
    body.set("line_items[1][price_data][unit_amount]", String(platformFeeCents));
    body.set("line_items[1][quantity]", "1");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const session = (await response.json()) as
    | CheckoutSession
    | { error?: { message?: string } };

  if (!response.ok || !("id" in session)) {
    const message =
      "error" in session && session.error?.message
        ? session.error.message
        : "Stripe could not create checkout.";

    throw new Error(message);
  }

  return session;
}

export async function POST(request: Request) {
  const canProcessStripeWebhooks = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!process.env.STRIPE_SECRET_KEY) {
    return redirectWithMessage(
      "/#merch",
      "Stripe is not configured yet. Add the Stripe secret key before checkout.",
    );
  }

  if (!canProcessStripeWebhooks) {
    return redirectWithMessage(
      "/#merch",
      "Checkout is almost ready. Finish server webhook setup before taking payments.",
    );
  }

  const formData = await request.formData();
  const productId = String(formData.get("product_id") ?? "").trim();
  const quantity = cleanQuantity(formData.get("quantity"));

  if (!productId) {
    return redirectWithMessage("/#merch", "Choose a merch product first.");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(
      `${siteUrl}/login?message=${encodeURIComponent("Sign in to buy merch.")}`,
      { status: 303 },
    );
  }

  const { data: product, error } = await supabase
    .from("merch_products")
    .select(
      "id, seller_id, title, description, sku, price_cents, currency, inventory_quantity, inventory_reserved",
    )
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle<Product>();

  if (error || !product) {
    return redirectWithMessage("/#merch", "That merch product is not available.");
  }

  if (product.seller_id === claims.sub) {
    return redirectWithMessage(`/merch/${product.id}`, "You cannot buy your own merch.");
  }

  const available = product.inventory_quantity - product.inventory_reserved;

  if (available < quantity) {
    return redirectWithMessage(
      `/merch/${product.id}`,
      "Not enough inventory is available for that quantity.",
    );
  }

  const orderId = crypto.randomUUID();
  const subtotalCents = product.price_cents * quantity;
  const platformFeeCents = calculatePlatformFeeCents(subtotalCents);
  const totalCents = subtotalCents + platformFeeCents;
  const successUrl = `${siteUrl}/merch/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}/merch/${product.id}?message=${encodeURIComponent(
    "Checkout canceled.",
  )}`;
  let session: CheckoutSession;

  try {
    session = await createCheckoutSession({
      buyerId: claims.sub,
      cancelUrl,
      orderId,
      platformFeeCents,
      product,
      quantity,
      subtotalCents,
      successUrl,
    });
  } catch (error) {
    return redirectWithMessage(
      `/merch/${product.id}`,
      error instanceof Error ? error.message : "Stripe could not create checkout.",
    );
  }

  const { error: orderError } = await supabase.from("merch_orders").insert({
    buyer_id: claims.sub,
    currency: product.currency,
    id: orderId,
    status: "pending_checkout",
    stripe_checkout_session_id: session.id,
    platform_fee_cents: platformFeeCents,
    subtotal_cents: subtotalCents,
    total_cents: totalCents,
  });

  if (orderError) {
    return redirectWithMessage(
      `/merch/${product.id}`,
      orderError.message || "Checkout started, but the order could not be saved.",
    );
  }

  const { error: itemError } = await supabase.from("merch_order_items").insert({
    currency: product.currency,
    line_total_cents: subtotalCents,
    order_id: orderId,
    product_id: product.id,
    quantity,
    seller_id: product.seller_id,
    sku_snapshot: product.sku,
    title_snapshot: product.title,
    unit_price_cents: product.price_cents,
  });

  if (itemError) {
    return redirectWithMessage(
      `/merch/${product.id}`,
      itemError.message || "Checkout started, but the order item could not be saved.",
    );
  }

  if (!session.url) {
    return redirectWithMessage(
      `/merch/${product.id}`,
      `${siteName} could not open Stripe Checkout for this product.`,
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
