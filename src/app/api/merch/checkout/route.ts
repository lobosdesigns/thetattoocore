import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  calculatePlatformFeeCents,
  platformFeeDescription,
} from "@/lib/payments/fees";
import { siteName, siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  sub: string;
};

type Product = {
  currency: string;
  description: string | null;
  id: string;
  inventory_quantity: number;
  inventory_reserved: number;
  is_official: boolean;
  price_cents: number;
  profiles: { account_type: string; license_verified_at: string | null } | null;
  seller_id: string;
  shipping_required: boolean;
  sku: string | null;
  title: string;
};

type CheckoutSession = {
  id: string;
  url: string | null;
};

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
    "submit_type": "pay",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
  });

  body.set("metadata[shipping_required]", String(product.shipping_required));
  body.set(
    "payment_intent_data[metadata][shipping_required]",
    String(product.shipping_required),
  );

  if (product.shipping_required) {
    body.set("shipping_address_collection[allowed_countries][0]", "US");
    body.set("shipping_address_collection[allowed_countries][1]", "CA");
  }

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
      platformFeeDescription("merch"),
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
      "id, seller_id, title, description, sku, price_cents, currency, inventory_quantity, inventory_reserved, shipping_required, is_official, profiles:profiles!merch_products_seller_id_fkey(account_type, license_verified_at)",
    )
    .eq("id", productId)
    .eq("status", "active")
    .eq("moderation_status", "active")
    .maybeSingle<Product>();

  if (error || !product) {
    return redirectWithMessage("/#merch", "That merch product is not available.");
  }

  if (!product.is_official && !isVerifiedProfessional(product.profiles)) {
    return redirectWithMessage(
      "/#merch",
      "That merch seller needs approval again before checkout can open.",
    );
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
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return redirectWithMessage(
      `/merch/${product.id}`,
      "Checkout is almost ready. Finish server webhook setup before taking payments.",
    );
  }

  const cancelUnreservedPendingOrder = async (message: string) => {
    await adminSupabase
      .from("merch_orders")
      .update({
        admin_note: message,
        cancelled_at: new Date().toISOString(),
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("buyer_id", claims.sub)
      .eq("status", "pending_checkout");
    revalidatePath("/account");
    revalidatePath("/admin");
    revalidatePath("/admin/merch");
    revalidatePath(`/merch/${product.id}`);
  };

  const { error: orderError } = await supabase.from("merch_orders").insert({
    buyer_id: claims.sub,
    currency: product.currency,
    id: orderId,
    status: "pending_checkout",
    platform_fee_cents: platformFeeCents,
    subtotal_cents: subtotalCents,
    total_cents: totalCents,
  });

  if (orderError) {
    return redirectWithMessage(
      `/merch/${product.id}`,
      orderError.message || "The order could not be saved before checkout.",
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
    await cancelUnreservedPendingOrder("Order item could not be saved before checkout.");

    return redirectWithMessage(
      `/merch/${product.id}`,
      itemError.message || "The order item could not be saved before checkout.",
    );
  }

  const cancelPendingOrder = async (message: string) => {
    await adminSupabase.rpc("release_merch_inventory_for_order", {
      p_order_id: orderId,
    });
    await adminSupabase
      .from("merch_orders")
      .update({
        admin_note: message,
        cancelled_at: new Date().toISOString(),
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("buyer_id", claims.sub)
      .eq("status", "pending_checkout");
    revalidatePath("/account");
    revalidatePath("/admin");
    revalidatePath("/admin/merch");
    revalidatePath(`/merch/${product.id}`);
  };

  const { error: reserveError } = await adminSupabase.rpc(
    "reserve_merch_inventory_for_order",
    { p_order_id: orderId },
  );

  if (reserveError) {
    await cancelPendingOrder("Inventory could not be reserved for checkout.");

    return redirectWithMessage(
      `/merch/${product.id}`,
      reserveError.message || "Inventory could not be reserved for checkout.",
    );
  }

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
    await cancelPendingOrder("Stripe could not create checkout.");

    return redirectWithMessage(
      `/merch/${product.id}`,
      error instanceof Error ? error.message : "Stripe could not create checkout.",
    );
  }

  const { data: sessionOrder, error: sessionError } = await adminSupabase
    .from("merch_orders")
    .update({
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("buyer_id", claims.sub)
    .eq("status", "pending_checkout")
    .is("stripe_checkout_session_id", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (sessionError) {
    await cancelPendingOrder("Checkout started, but the order session could not be saved.");

    return redirectWithMessage(
      `/merch/${product.id}`,
      sessionError.message || "Checkout started, but the order session could not be saved.",
    );
  }

  if (!sessionOrder) {
    await cancelPendingOrder("Checkout started, but the pending order could not be reserved for this Stripe session.");

    return redirectWithMessage(
      `/merch/${product.id}`,
      "Checkout started, but the pending order could not be reserved for this Stripe session.",
    );
  }

  if (!session.url) {
    await cancelPendingOrder("Stripe did not return a checkout URL.");

    return redirectWithMessage(
      `/merch/${product.id}`,
      `${siteName} could not open Stripe Checkout for this product.`,
    );
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/merch");
  revalidatePath(`/merch/${product.id}`);

  return NextResponse.redirect(session.url, { status: 303 });
}
