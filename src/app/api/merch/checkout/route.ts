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

function safeInternalReturnPath(value: FormDataEntryValue | null) {
  const text = String(value ?? "")
    .trim()
    .slice(0, 240);

  if (!text || !text.startsWith("/") || text.startsWith("//") || text.includes("\\")) {
    return null;
  }

  return text;
}

function pathWithMessage(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}message=${encodeURIComponent(message)}`;
}

function redirectWithMessage(path: string, message: string) {
  return NextResponse.redirect(
    `${siteUrl}${pathWithMessage(path, message)}`,
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
    throw new Error("Checkout is almost ready. Payment setup is still being finished.");
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
        : "Checkout could not open.";

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
      "Checkout is almost ready. Payment setup is still being finished.",
    );
  }

  if (!canProcessStripeWebhooks) {
    return redirectWithMessage(
      "/#merch",
      "Checkout is almost ready. Payment setup is still being finished.",
    );
  }

  const formData = await request.formData();
  const productId = String(formData.get("product_id") ?? "").trim();
  const quantity = cleanQuantity(formData.get("quantity"));
  const formReturnTo = safeInternalReturnPath(formData.get("return_to"));

  if (!productId) {
    return redirectWithMessage(formReturnTo ?? "/#merch", "Choose a merch product first.");
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
    return redirectWithMessage(formReturnTo ?? "/#merch", "That merch product is not available.");
  }

  const returnTo = formReturnTo ?? `/merch/${product.id}`;

  if (!product.is_official && !isVerifiedProfessional(product.profiles)) {
    return redirectWithMessage(
      returnTo,
      "That merch seller needs approval again before checkout can open.",
    );
  }

  if (product.seller_id === claims.sub) {
    return redirectWithMessage(returnTo, "You cannot buy your own merch.");
  }

  const available = product.inventory_quantity - product.inventory_reserved;

  if (available < quantity) {
    return redirectWithMessage(
      returnTo,
      "Not enough inventory is available for that quantity.",
    );
  }

  const orderId = crypto.randomUUID();
  const subtotalCents = product.price_cents * quantity;
  const platformFeeCents = calculatePlatformFeeCents(subtotalCents);
  const totalCents = subtotalCents + platformFeeCents;
  const successUrl = `${siteUrl}/merch/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}${pathWithMessage(returnTo, "Checkout canceled.")}`;
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return redirectWithMessage(
      returnTo,
      "Checkout is almost ready. Payment setup is still being finished.",
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
      returnTo,
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
      returnTo,
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
      returnTo,
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
    await cancelPendingOrder("Checkout could not open.");

    return redirectWithMessage(
      returnTo,
      error instanceof Error ? error.message : "Checkout could not open.",
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
      returnTo,
      sessionError.message || "Checkout started, but the order session could not be saved.",
    );
  }

  if (!sessionOrder) {
    await cancelPendingOrder("Checkout started, but the pending order could not be reserved for this checkout.");

    return redirectWithMessage(
      returnTo,
      "Checkout started, but the pending order could not be reserved for this checkout.",
    );
  }

  if (!session.url) {
    await cancelPendingOrder("Checkout did not return a secure payment link.");

    return redirectWithMessage(
      returnTo,
      `${siteName} could not open checkout for this product.`,
    );
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/merch");
  revalidatePath(`/merch/${product.id}`);

  return NextResponse.redirect(session.url, { status: 303 });
}
