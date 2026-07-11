import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Package,
  ShieldCheck,
  Store,
} from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import { updateMerchOrderStatus, updateMerchProductStatus } from "../actions";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type ProductStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "active"
  | "paused"
  | "rejected"
  | "archived";
type ModerationStatus = "active" | "under_review" | "hidden" | "removed";
type MerchProduct = {
  category: string;
  createdAt: string;
  currency: string;
  id: string;
  inventoryQuantity: number;
  isOfficial: boolean;
  moderationStatus: ModerationStatus;
  sellerAccountType: string | null;
  sellerLicenseVerifiedAt: string | null;
  priceCents: number;
  sellerName: string;
  sellerUsername: string;
  status: ProductStatus;
  title: string;
};
type MerchOrder = {
  adminNote: string | null;
  buyerName: string;
  buyerUsername: string;
  createdAt: string;
  currency: string;
  customerEmail: string | null;
  discountCents: number;
  id: string;
  itemCount: number;
  platformFeeCents: number;
  shippingCents: number;
  shippingName: string | null;
  status: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const merchRules = [
  "Merch is public-buyable brand goods, separate from verified-only professional Stuff.",
  "Artist, studio, vendor, and official TheTattooCore sellers still need approval before listing products.",
  "Do not allow professional equipment, regulated services, unsafe products, counterfeits, adult sexual products, or scratcher-facing supplies.",
  "Stripe checkout and refund-status webhooks are wired in test mode; finish tax, shipping, fulfillment, payouts, and payment-provider safety rules before public production orders.",
] as const;
const buildSteps = [
  [
    "Seller approval",
    "Artist, studio, and vendor license verification unlocks seller access. Official TTC products stay admin-controlled.",
  ],
  [
    "Product catalog",
    "Product, inventory, image, moderation, and future Stripe ids are now modeled in the database foundation.",
  ],
  [
    "Checkout",
    "Stripe Checkout, paid/failed/refunded webhooks, and inventory decrement are wired in test mode. Next: taxes, receipts, fulfillment, and production review.",
  ],
  [
    "Admin operations",
    "Keep this page paged at 50 items, then add review actions, order lookup, seller health, and fraud flags.",
  ],
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Merch",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref({
  orderPage = 1,
  page = 1,
}: {
  orderPage?: number;
  page?: number;
}) {
  const params = new URLSearchParams();

  if (page > 1) params.set("page", String(page));
  if (orderPage > 1) params.set("order_page", String(orderPage));

  const query = params.toString();

  return query ? `/admin/merch?${query}` : "/admin/merch";
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function money(cents: number, currency: string) {
  return Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function statusClass(status: ProductStatus) {
  if (status === "active" || status === "approved") {
    return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  }

  if (status === "pending_review") {
    return "border-[color-mix(in_srgb,#5078c8_35%,var(--card-rim))] bg-[color-mix(in_srgb,#5078c8_10%,var(--paper-warm))] text-[color-mix(in_srgb,#284f8a_78%,var(--foreground))]";
  }

  if (status === "rejected" || status === "archived") {
    return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
  }

  return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
}

function moderationStatusClass(status: ModerationStatus) {
  if (status === "active") {
    return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  }

  if (status === "under_review") {
    return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
  }

  return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
}

function Pagination({
  currentPage,
  hasNextPage,
  hrefForPage,
  pageSizeLabel = "50",
  totalPages,
}: {
  currentPage: number;
  hasNextPage: boolean;
  hrefForPage: (page: number) => string;
  pageSizeLabel?: string;
  totalPages: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[var(--muted)]">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={currentPage <= 1}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            currentPage <= 1
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
          }`}
          href={hrefForPage(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous {pageSizeLabel}
        </Link>
        <Link
          aria-disabled={!hasNextPage}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            !hasNextPage
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
          }`}
          href={hrefForPage(currentPage + 1)}
        >
          Next {pageSizeLabel}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  returnTo,
}: {
  product: MerchProduct;
  returnTo: string;
}) {
  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{product.title}</p>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            @{product.sellerUsername} - {product.category} - {timeAgo(product.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${statusClass(
              product.status,
            )}`}
          >
            {product.status.replace("_", " ")}
          </span>
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${moderationStatusClass(
              product.moderationStatus,
            )}`}
          >
            Moderation {product.moderationStatus.replace("_", " ")}
          </span>
          {product.isOfficial ? (
            <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-2 py-1 text-xs font-semibold">
              Official TTC
            </span>
          ) : null}
          {!product.isOfficial ? (
            <span
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                product.sellerLicenseVerifiedAt
                  ? "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                  : "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]"
              }`}
            >
              {product.sellerLicenseVerifiedAt
                ? "Seller verified"
                : "Seller not verified"}
            </span>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Price</dt>
          <dd>{money(product.priceCents, product.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Inventory
          </dt>
          <dd>{Intl.NumberFormat("en-US").format(product.inventoryQuantity)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Seller</dt>
          <dd>
            {product.sellerName}
            {product.sellerAccountType ? ` - ${product.sellerAccountType}` : ""}
          </dd>
        </div>
      </dl>
      <form action={updateMerchProductStatus} className="mt-4 space-y-2">
        <input name="product_id" type="hidden" value={product.id} />
        <input name="return_to" type="hidden" value={returnTo} />
        <input
          className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
          maxLength={500}
          name="note"
          placeholder="Reviewer note"
        />
        <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-5">
          {[
            ["approved", "Approve"],
            ["active", "Activate"],
            ["paused", "Pause"],
            ["rejected", "Reject"],
            ["archived", "Archive"],
          ].map(([value, label]) => (
            <button
              className={
                value === "active"
                  ? "h-10 rounded-md bg-[var(--foreground)] px-2 text-sm font-semibold text-[var(--background)]"
                  : "h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-sm font-semibold"
              }
              key={value}
              name="status"
              value={value}
            >
              {label}
            </button>
          ))}
        </div>
      </form>
    </article>
  );
}

function OrderCard({
  order,
  returnTo,
}: {
  order: MerchOrder;
  returnTo: string;
}) {
  const canFulfill = order.status === "paid";
  const canCancel = ["pending_checkout", "payment_failed", "cancelled"].includes(
    order.status,
  );

  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">
            Order {order.id.slice(0, 8)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            @{order.buyerUsername} - {timeAgo(order.createdAt)}
          </p>
        </div>
        <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted)]">
          {order.status.replace("_", " ")}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Buyer</dt>
          <dd>{order.buyerName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Items</dt>
          <dd>{Intl.NumberFormat("en-US").format(order.itemCount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Subtotal</dt>
          <dd>{money(order.subtotalCents, order.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">TTC fee</dt>
          <dd>{money(order.platformFeeCents, order.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Shipping</dt>
          <dd>{money(order.shippingCents, order.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Tax</dt>
          <dd>{money(order.taxCents, order.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Discount</dt>
          <dd>
            {order.discountCents > 0
              ? `-${money(order.discountCents, order.currency)}`
              : money(0, order.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Total</dt>
          <dd>{money(order.totalCents, order.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Ship to</dt>
          <dd>{order.shippingName || "Not collected"}</dd>
        </div>
      </dl>
      {order.customerEmail || order.adminNote ? (
        <div className="mt-3 space-y-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
          {order.customerEmail ? <p>Email: {order.customerEmail}</p> : null}
          {order.adminNote ? <p>Admin note: {order.adminNote}</p> : null}
        </div>
      ) : null}
      <form action={updateMerchOrderStatus} className="mt-4 space-y-2">
        <input name="order_id" type="hidden" value={order.id} />
        <input name="return_to" type="hidden" value={returnTo} />
        <input
          className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
          maxLength={1000}
          name="note"
          placeholder="Order note for fulfillment, cancellation, or handoff"
        />
        <div className="grid gap-2 min-[430px]:grid-cols-2">
          <button
            className={`h-10 rounded-md px-3 text-sm font-semibold ${
              canFulfill
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_90%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
            }`}
            disabled={!canFulfill}
            name="status"
            value="fulfilled"
          >
            Mark fulfilled
          </button>
          <button
            className={`h-10 rounded-md border px-3 text-sm font-semibold ${
              canCancel
                ? "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]"
                : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_90%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
            }`}
            disabled={!canCancel}
            name="status"
            value="cancelled"
          >
            Cancel unpaid
          </button>
        </div>
        <p className="text-xs leading-5 text-[var(--muted-strong)]">
          Refund paid orders in Stripe first; the webhook updates refunded status.
        </p>
      </form>
    </article>
  );
}

export default async function AdminMerchPage({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    order_page?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const currentPage = pageNumber(params.page);
  const currentOrderPage = pageNumber(params.order_page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const orderFrom = (currentOrderPage - 1) * pageSize;
  const orderTo = orderFrom + pageSize - 1;
  const currentProductHref = pageHref({
    orderPage: currentOrderPage,
    page: currentPage,
  });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", claims.sub)
    .maybeSingle<{ username: string; display_name: string; role: UserRole }>();

  if (!profile || !viewRoles.includes(profile.role)) {
    redirect("/admin");
  }

  const { count, data: productRows, error: productError } = await supabase
    .from("merch_products")
    .select(
      "id, title, category, status, moderation_status, price_cents, currency, inventory_quantity, is_official, created_at, profiles:profiles!merch_products_seller_id_fkey(account_type, display_name, license_verified_at, username)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        category: string;
        created_at: string;
        currency: string;
        id: string;
        inventory_quantity: number;
        is_official: boolean;
        moderation_status: ModerationStatus;
        price_cents: number;
        profiles: {
          account_type: string | null;
          display_name: string;
          license_verified_at: string | null;
          username: string;
        } | null;
        status: ProductStatus;
        title: string;
      }[]
    >();
  const products: MerchProduct[] = (productRows ?? []).map((product) => ({
    category: product.category,
    createdAt: product.created_at,
    currency: product.currency,
    id: product.id,
    inventoryQuantity: product.inventory_quantity,
    isOfficial: product.is_official,
    moderationStatus: product.moderation_status,
    priceCents: product.price_cents,
    sellerAccountType: product.profiles?.account_type ?? null,
    sellerLicenseVerifiedAt: product.profiles?.license_verified_at ?? null,
    sellerName: product.profiles?.display_name ?? "Seller",
    sellerUsername: product.profiles?.username ?? "seller",
    status: product.status,
    title: product.title,
  }));
  const totalProducts = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const hasNextPage = currentPage < totalPages;
  const activeCount = products.filter((product) => product.status === "active").length;
  const reviewCount = products.filter(
    (product) => product.status === "pending_review",
  ).length;
  const moderationCount = products.filter(
    (product) => product.moderationStatus !== "active",
  ).length;
  const { count: orderCount, data: orderRows } = await supabase
    .from("merch_orders")
    .select(
      "id, status, currency, subtotal_cents, platform_fee_cents, shipping_cents, tax_cents, discount_cents, total_cents, customer_email, shipping_name, admin_note, created_at, profiles:profiles!merch_orders_buyer_id_fkey(display_name, username), merch_order_items(id)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(orderFrom, orderTo)
    .returns<
      {
        admin_note: string | null;
        created_at: string;
        currency: string;
        customer_email: string | null;
        discount_cents: number;
        id: string;
        merch_order_items: { id: string }[];
        platform_fee_cents: number;
        profiles: { display_name: string; username: string } | null;
        shipping_cents: number;
        shipping_name: string | null;
        status: string;
        subtotal_cents: number;
        tax_cents: number;
        total_cents: number;
      }[]
    >();
  const orders: MerchOrder[] = (orderRows ?? []).map((order) => ({
    adminNote: order.admin_note,
    buyerName: order.profiles?.display_name ?? "Buyer",
    buyerUsername: order.profiles?.username ?? "buyer",
    createdAt: order.created_at,
    currency: order.currency,
    customerEmail: order.customer_email,
    discountCents: order.discount_cents,
    id: order.id,
    itemCount: order.merch_order_items.length,
    platformFeeCents: order.platform_fee_cents,
    shippingCents: order.shipping_cents,
    shippingName: order.shipping_name,
    status: order.status,
    subtotalCents: order.subtotal_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
  }));
  const totalOrders = orderCount ?? 0;
  const totalOrderPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const hasNextOrderPage = currentOrderPage < totalOrderPages;
  const currentOrderHref = pageHref({
    orderPage: currentOrderPage,
    page: currentPage,
  });

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <section className="ttc-page-panel mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-[var(--card-rim)] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to admin dashboard"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)]"
              href="/admin"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
                Admin
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Merch</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                50 public-buyable products per page for catalog, seller, and payment-readiness review.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-sm">
            <p className="font-semibold">{profile.display_name}</p>
            <p className="text-xs text-[var(--muted-strong)]">
              @{profile.username} - {profile.role}
            </p>
          </div>
        </header>

        <AdminSectionNav activeHref="/admin/merch" />

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <Package className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Products</p>
            <p className="mt-1 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalProducts)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <Store className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Active here</p>
            <p className="mt-1 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <CreditCard className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Needs review here</p>
            <p className="mt-1 text-3xl font-bold">{reviewCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <ShieldCheck className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Moderated here</p>
            <p className="mt-1 text-3xl font-bold">{moderationCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <ShieldCheck className="size-5 text-[var(--gold)]" />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Orders</p>
            <p className="mt-1 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(orderCount ?? 0)}
            </p>
          </div>
        </div>

        {productError ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] p-4 text-sm leading-6 text-[var(--muted)]">
            Merch products could not load. Check Supabase table access,
            migrations, or the database error before reviewing products.
          </p>
        ) : null}

        {params.message ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
            <h2 className="text-lg font-bold">Build path</h2>
            <div className="mt-4 grid gap-3">
              {buildSteps.map(([label, body]) => (
                <article
                  className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3"
                  key={label}
                >
                  <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="size-5 text-[var(--gold)]" />
                <h2 className="text-lg font-bold">Rules</h2>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                {merchRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>

            <section className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
              <h2 className="text-lg font-bold">Allowed examples</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {["T-shirts", "Prints", "Art", "Stickers", "Official TTC merch"].map(
                  (item) => (
                    <span
                      className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2.5 py-1.5 text-xs font-semibold"
                      key={item}
                    >
                      {item}
                    </span>
                  ),
                )}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-4">
          <Pagination
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            hrefForPage={(nextPage) =>
              pageHref({ orderPage: currentOrderPage, page: nextPage })
            }
            totalPages={totalPages}
          />

          {products.length ? (
            <div className="mt-4 grid gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  returnTo={currentProductHref}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
              No Merch products exist yet.
            </p>
          )}

          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              hasNextPage={hasNextPage}
              hrefForPage={(nextPage) =>
                pageHref({ orderPage: currentOrderPage, page: nextPage })
              }
              totalPages={totalPages}
            />
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Recent Orders</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Stripe checkout writes paid, failed, expired, and refunded order states here.
              </p>
            </div>
            <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm font-semibold">
              Page {currentOrderPage} of {totalOrderPages}
            </span>
          </div>
          <Pagination
            currentPage={currentOrderPage}
            hasNextPage={hasNextOrderPage}
            hrefForPage={(nextOrderPage) =>
              pageHref({ orderPage: nextOrderPage, page: currentPage })
            }
            totalPages={totalOrderPages}
          />
          {orders.length ? (
            <div className="mt-4 grid gap-3">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  returnTo={currentOrderHref}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4 text-sm text-[var(--muted)]">
              No orders yet.
            </p>
          )}
          <div className="mt-4">
            <Pagination
              currentPage={currentOrderPage}
              hasNextPage={hasNextOrderPage}
              hrefForPage={(nextOrderPage) =>
                pageHref({ orderPage: nextOrderPage, page: currentPage })
              }
              totalPages={totalOrderPages}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
