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
import {
  commerceStatusLabel,
  titleCaseStatus,
} from "@/lib/status-labels";
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
  fulfillmentNotes: string | null;
  id: string;
  inventoryQuantity: number;
  inventoryReserved: number;
  isOfficial: boolean;
  moderationStatus: ModerationStatus;
  sellerAccountType: string | null;
  sellerLicenseVerifiedAt: string | null;
  sellerPayoutDisabledReason: string | null;
  sellerPayoutStatus: "ready" | "incomplete" | "not_started";
  priceCents: number;
  returnPolicy: string | null;
  sellerName: string;
  sellerUsername: string;
  status: ProductStatus;
  title: string;
};
type MerchOrder = {
  adminNote: string | null;
  buyerName: string;
  buyerUsername: string;
  cancelledAt: string | null;
  createdAt: string;
  currency: string;
  customerEmail: string | null;
  discountCents: number;
  fulfilledAt: string | null;
  id: string;
  itemCount: number;
  items: {
    quantity: number;
    sellerFulfilledAt: string | null;
    title: string;
    trackingCarrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  }[];
  platformFeeCents: number;
  refundedAt: string | null;
  shippingAddress: Record<string, unknown> | null;
  shippingCents: number;
  shippingName: string | null;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};
type SellerPayoutFilter = "ready" | "incomplete" | "not_started";

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const productStatusFilters = [
  "pending_review",
  "approved",
  "active",
  "paused",
  "rejected",
  "archived",
] as const;
const orderStatusFilters = [
  "pending_checkout",
  "paid",
  "payment_failed",
  "cancelled",
  "fulfilled",
  "partially_refunded",
  "refunded",
] as const;
const sellerPayoutFilters = ["ready", "incomplete", "not_started"] as const;
const orderFulfillmentFilters = ["needs_fulfillment", "seller_fulfilled"] as const;
const impossibleUuid = "00000000-0000-0000-0000-000000000000";
const merchRules = [
  "Merch is public-buyable brand goods, separate from verified-only professional Stuff.",
  "Artist, studio, vendor, and official TheTattooCore sellers still need approval before listing products.",
  "Do not allow professional equipment, regulated services, unsafe products, counterfeits, adult sexual products, or scratcher-facing supplies.",
  "Checkout and refund status are limited during launch; finish tax, shipping, fulfillment, payouts, and payment safety rules before public production orders.",
] as const;
const buildSteps = [
  [
    "Seller approval",
    "Artist, studio, and vendor license verification unlocks seller access. Official TTC products stay admin-controlled.",
  ],
  [
    "Product catalog",
    "Product, inventory, image, moderation, and payment tracking are now modeled.",
  ],
  [
    "Checkout",
    "Checkout, paid/failed/refunded status updates, inventory decrement, and buyer printable receipts are wired for launch testing. Remaining review areas: taxes, fulfillment, payouts, and production rules.",
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

function orderStatusFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return orderStatusFilters.find((status) => status === rawValue) ?? null;
}

function productStatusFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return productStatusFilters.find((status) => status === rawValue) ?? null;
}

function sellerPayoutFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return sellerPayoutFilters.find((status) => status === rawValue) ?? null;
}

function orderFulfillmentFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return orderFulfillmentFilters.find((status) => status === rawValue) ?? null;
}

function searchTerm(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = (rawValue ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 @._-]/g, " ")
    .replace(/\s+/g, " ");

  return normalized.slice(0, 80);
}

function pageHref({
  orderFulfillmentStatus,
  orderPage = 1,
  orderStatus,
  page = 1,
  productStatus,
  sellerPayoutStatus,
  search,
}: {
  orderFulfillmentStatus?: string | null;
  orderPage?: number;
  orderStatus?: string | null;
  page?: number;
  productStatus?: string | null;
  sellerPayoutStatus?: string | null;
  search?: string | null;
}) {
  const params = new URLSearchParams();

  if (page > 1) params.set("page", String(page));
  if (orderPage > 1) params.set("order_page", String(orderPage));
  if (orderFulfillmentStatus) params.set("fulfillment", orderFulfillmentStatus);
  if (orderStatus) params.set("order_status", orderStatus);
  if (productStatus) params.set("product_status", productStatus);
  if (sellerPayoutStatus) params.set("seller_payout", sellerPayoutStatus);
  if (search) params.set("q", search);

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function money(cents: number, currency: string) {
  return Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function shippingAddressLines(value: unknown) {
  if (!value || typeof value !== "object") return [];

  const root = value as {
    address?: Record<string, unknown>;
    name?: unknown;
  };
  const address = root.address && typeof root.address === "object" ? root.address : {};
  const text = (key: string) =>
    typeof address[key] === "string" ? String(address[key]).trim() : "";
  const cityStatePostal = [text("city"), text("state"), text("postal_code")]
    .filter(Boolean)
    .join(", ");

  return [
    typeof root.name === "string" ? root.name.trim() : "",
    text("line1"),
    text("line2"),
    cityStatePostal,
    text("country"),
  ].filter(Boolean);
}

function statusLabel(value: string) {
  return titleCaseStatus(value);
}

function payoutStatusLabel(value: SellerPayoutFilter) {
  if (value === "ready") return "Payout ready";
  if (value === "incomplete") return "Payout setup incomplete";

  return "Payout not started";
}

function fulfillmentFilterLabel(value: (typeof orderFulfillmentFilters)[number]) {
  if (value === "needs_fulfillment") return "Needs fulfillment";

  return "Seller fulfilled";
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
  const payoutLabel =
    product.sellerPayoutStatus === "ready"
      ? "Payout ready"
      : product.sellerPayoutStatus === "incomplete"
        ? "Payout setup incomplete"
        : "Payout not started";
  const canActivateCheckout =
    product.isOfficial || product.sellerPayoutStatus === "ready";

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
            {statusLabel(product.status)}
          </span>
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${moderationStatusClass(
              product.moderationStatus,
            )}`}
          >
            Moderation {statusLabel(product.moderationStatus)}
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
          {!product.isOfficial ? (
            <span
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                product.sellerPayoutStatus === "ready"
                  ? "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                  : product.sellerPayoutStatus === "incomplete"
                    ? "border-[color-mix(in_srgb,var(--gold)_55%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_14%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_76%,var(--foreground))]"
                    : "border-[color-mix(in_srgb,var(--danger)_34%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_9%,var(--paper-warm))] text-[var(--danger)]"
              }`}
            >
              {payoutLabel}
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
          <dd>
            {Intl.NumberFormat("en-US").format(
              Math.max(0, product.inventoryQuantity - product.inventoryReserved),
            )}{" "}
            available
            {product.inventoryReserved > 0 ? (
              <span className="block text-xs text-[var(--muted-strong)]">
                {Intl.NumberFormat("en-US").format(product.inventoryReserved)} reserved
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Seller</dt>
          <dd>
            {product.sellerName}
            {product.sellerAccountType ? ` - ${product.sellerAccountType}` : ""}
          </dd>
        </div>
      </dl>
      {product.sellerPayoutDisabledReason ? (
        <p className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--paper-warm))] p-2 text-xs font-semibold text-[color-mix(in_srgb,var(--gold)_82%,var(--foreground))]">
          Payout note: {product.sellerPayoutDisabledReason}
        </p>
      ) : null}
      {!canActivateCheckout ? (
        <p className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--paper-warm))] p-2 text-xs font-semibold text-[color-mix(in_srgb,var(--gold)_82%,var(--foreground))]">
          Activation waits for seller payout setup. Approve can still be used
          for review, but checkout stays closed until payouts are ready.
        </p>
      ) : null}
      {product.fulfillmentNotes || product.returnPolicy ? (
        <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted)] sm:grid-cols-2">
          {product.fulfillmentNotes ? (
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-2">
              <p className="font-bold uppercase text-[var(--muted-strong)]">
                Fulfillment notes
              </p>
              <p className="mt-1 whitespace-pre-wrap">{product.fulfillmentNotes}</p>
            </div>
          ) : null}
          {product.returnPolicy ? (
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-2">
              <p className="font-bold uppercase text-[var(--muted-strong)]">
                Return note
              </p>
              <p className="mt-1 whitespace-pre-wrap">{product.returnPolicy}</p>
            </div>
          ) : null}
        </div>
      ) : null}
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
          ].map(([value, label]) => {
            const activationBlocked = value === "active" && !canActivateCheckout;

            return (
            <button
              className={
                activationBlocked
                  ? "h-10 cursor-not-allowed rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] px-2 text-sm font-semibold text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
                  : value === "active"
                    ? "h-10 rounded-md bg-[var(--foreground)] px-2 text-sm font-semibold text-[var(--background)]"
                  : "h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-sm font-semibold"
              }
              disabled={activationBlocked}
              key={value}
              name="status"
              title={
                activationBlocked
                  ? "Seller payout setup is required before checkout can be activated."
                  : undefined
              }
              value={value}
            >
              {label}
            </button>
            );
          })}
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
  const addressLines = shippingAddressLines(order.shippingAddress);

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
          {commerceStatusLabel(order.status)}
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
      {order.items.length ? (
        <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
          <p className="font-semibold uppercase text-[var(--muted-strong)]">
            Items ordered
          </p>
          <ul className="mt-2 space-y-1">
            {order.items.map((item) => (
              <li
                className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_80%,transparent)] p-2 text-[var(--foreground)]"
                key={`${item.title}-${item.quantity}-${item.trackingNumber ?? "none"}`}
              >
                <div className="flex justify-between gap-3">
                  <span>{item.title}</span>
                  <span className="shrink-0 font-semibold">x{item.quantity}</span>
                </div>
                {item.sellerFulfilledAt ||
                item.trackingCarrier ||
                item.trackingNumber ||
                item.trackingUrl ? (
                  <div className="mt-1 space-y-1 text-xs leading-5 text-[var(--muted)]">
                    {item.sellerFulfilledAt ? (
                      <p>Seller fulfilled {formatDateTime(item.sellerFulfilledAt)}</p>
                    ) : null}
                    {item.trackingCarrier || item.trackingNumber ? (
                      <p>
                        Tracking: {[item.trackingCarrier, item.trackingNumber]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    ) : null}
                    {item.trackingUrl ? (
                      <p>
                        Tracking link:{" "}
                        <a
                          className="font-semibold underline"
                          href={item.trackingUrl}
                          rel="ugc nofollow noopener noreferrer"
                          target="_blank"
                        >
                          Open
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {addressLines.length ? (
        <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
          <p className="font-semibold uppercase text-[var(--muted-strong)]">
            Shipping address
          </p>
          <address className="mt-2 not-italic">
            {addressLines.map((line) => (
              <span className="block" key={line}>
                {line}
              </span>
            ))}
          </address>
        </div>
      ) : null}
      {order.customerEmail || order.adminNote ? (
        <div className="mt-3 space-y-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
          {order.customerEmail ? <p>Email: {order.customerEmail}</p> : null}
          {order.adminNote ? <p>Admin note: {order.adminNote}</p> : null}
        </div>
      ) : null}
      {order.stripeCheckoutSessionId || order.stripePaymentIntentId ? (
        <div className="mt-3 grid gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)] sm:grid-cols-2">
          {order.stripeCheckoutSessionId ? (
            <p className="break-all">
              Checkout session:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {order.stripeCheckoutSessionId}
              </span>
            </p>
          ) : null}
          {order.stripePaymentIntentId ? (
            <p className="break-all">
              Payment intent:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {order.stripePaymentIntentId}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      {order.fulfilledAt || order.cancelledAt || order.refundedAt ? (
        <div className="mt-3 grid gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_88%,transparent)] p-3 text-xs leading-5 text-[var(--muted)] sm:grid-cols-3">
          {order.fulfilledAt ? (
            <p>Fulfilled {formatDateTime(order.fulfilledAt)}</p>
          ) : null}
          {order.cancelledAt ? (
            <p>Cancelled {formatDateTime(order.cancelledAt)}</p>
          ) : null}
          {order.refundedAt ? (
            <p>Refunded {formatDateTime(order.refundedAt)}</p>
          ) : null}
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
          Refund paid orders in the payment dashboard first; payment updates will sync status here.
        </p>
      </form>
    </article>
  );
}

export default async function AdminMerchPage({
  searchParams,
}: {
  searchParams: Promise<{
    fulfillment?: string | string[];
    message?: string;
    order_page?: string | string[];
    order_status?: string | string[];
    page?: string | string[];
    product_status?: string | string[];
    q?: string | string[];
    seller_payout?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const currentPage = pageNumber(params.page);
  const currentOrderPage = pageNumber(params.order_page);
  const activeOrderFulfillmentStatus = orderFulfillmentFilter(params.fulfillment);
  const activeOrderStatus = orderStatusFilter(params.order_status);
  const activeProductStatus = productStatusFilter(params.product_status);
  const activeSellerPayoutStatus = sellerPayoutFilter(params.seller_payout);
  const activeSearch = searchTerm(params.q);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const orderFrom = (currentOrderPage - 1) * pageSize;
  const orderTo = orderFrom + pageSize - 1;
  const currentProductHref = pageHref({
    orderFulfillmentStatus: activeOrderFulfillmentStatus,
    orderPage: currentOrderPage,
    orderStatus: activeOrderStatus,
    page: currentPage,
    productStatus: activeProductStatus,
    sellerPayoutStatus: activeSellerPayoutStatus,
    search: activeSearch,
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

  const { data: allSellerPayoutRows } = activeSellerPayoutStatus
    ? await supabase
        .from("stripe_connect_accounts")
        .select("profile_id, charges_enabled, payouts_enabled, details_submitted")
        .returns<
          {
            charges_enabled: boolean;
            details_submitted: boolean;
            payouts_enabled: boolean;
            profile_id: string;
          }[]
        >()
    : { data: [] };
  const matchingSellerPayoutIds = (allSellerPayoutRows ?? [])
    .filter((account) => {
      const isReady =
        account.charges_enabled && account.payouts_enabled && account.details_submitted;

      if (activeSellerPayoutStatus === "ready") return isReady;
      if (activeSellerPayoutStatus === "incomplete") return !isReady;

      return true;
    })
    .map((account) => account.profile_id);

  let productQuery = supabase
    .from("merch_products")
    .select(
      "id, seller_id, title, category, status, moderation_status, price_cents, currency, inventory_quantity, inventory_reserved, fulfillment_notes, return_policy, is_official, created_at, profiles:profiles!merch_products_seller_id_fkey(account_type, display_name, license_verified_at, username)",
      { count: "exact" },
    );

  if (activeProductStatus) {
    productQuery = productQuery.eq("status", activeProductStatus);
  }
  if (activeSellerPayoutStatus === "ready" || activeSellerPayoutStatus === "incomplete") {
    productQuery = matchingSellerPayoutIds.length
      ? productQuery.in("seller_id", matchingSellerPayoutIds)
      : productQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  if (activeSellerPayoutStatus === "not_started" && matchingSellerPayoutIds.length) {
    productQuery = productQuery.not(
      "seller_id",
      "in",
      `(${matchingSellerPayoutIds.join(",")})`,
    );
  }
  if (activeSearch) {
    productQuery = productQuery.or(
      `title.ilike.%${activeSearch}%,category.ilike.%${activeSearch}%`,
    );
  }

  const { count, data: productRows, error: productError } = await productQuery
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        category: string;
        created_at: string;
        currency: string;
        fulfillment_notes: string | null;
        id: string;
        inventory_quantity: number;
        inventory_reserved: number;
        is_official: boolean;
        moderation_status: ModerationStatus;
        price_cents: number;
        profiles: {
          account_type: string | null;
          display_name: string;
          license_verified_at: string | null;
          username: string;
        } | null;
        return_policy: string | null;
        seller_id: string;
        status: ProductStatus;
        title: string;
      }[]
    >();
  const sellerIds = Array.from(
    new Set((productRows ?? []).map((product) => product.seller_id).filter(Boolean)),
  );
  const { data: sellerPayoutRows } =
    sellerIds.length > 0
      ? await supabase
          .from("stripe_connect_accounts")
          .select(
            "profile_id, charges_enabled, payouts_enabled, details_submitted, disabled_reason",
          )
          .in("profile_id", sellerIds)
          .returns<
            {
              charges_enabled: boolean;
              details_submitted: boolean;
              disabled_reason: string | null;
              payouts_enabled: boolean;
              profile_id: string;
            }[]
          >()
      : { data: [] };
  const sellerPayoutByProfile = new Map(
    (sellerPayoutRows ?? []).map((account) => [account.profile_id, account]),
  );
  const products: MerchProduct[] = (productRows ?? []).map((product) => ({
    category: product.category,
    createdAt: product.created_at,
    currency: product.currency,
    fulfillmentNotes: product.fulfillment_notes,
    id: product.id,
    inventoryQuantity: product.inventory_quantity,
    inventoryReserved: product.inventory_reserved,
    isOfficial: product.is_official,
    moderationStatus: product.moderation_status,
    priceCents: product.price_cents,
    returnPolicy: product.return_policy,
    sellerAccountType: product.profiles?.account_type ?? null,
    sellerLicenseVerifiedAt: product.profiles?.license_verified_at ?? null,
    sellerName: product.profiles?.display_name ?? "Seller",
    sellerPayoutDisabledReason:
      sellerPayoutByProfile.get(product.seller_id)?.disabled_reason ?? null,
    sellerPayoutStatus: !sellerPayoutByProfile.has(product.seller_id)
      ? "not_started"
      : sellerPayoutByProfile.get(product.seller_id)?.charges_enabled &&
          sellerPayoutByProfile.get(product.seller_id)?.payouts_enabled &&
          sellerPayoutByProfile.get(product.seller_id)?.details_submitted
        ? "ready"
        : "incomplete",
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
  const { count: needsFulfillmentItemCount } = await supabase
    .from("merch_order_items")
    .select("id, merch_orders!inner(status)", { count: "exact", head: true })
    .is("seller_fulfilled_at", null)
    .eq("merch_orders.status", "paid");
  const matchingOrderItemIds = activeSearch
    ? (
        await supabase
          .from("merch_order_items")
          .select("order_id")
          .ilike("title_snapshot", `%${activeSearch}%`)
          .limit(100)
          .returns<{ order_id: string }[]>()
      ).data?.map((item) => item.order_id) ?? []
    : [];
  const uniqueMatchingOrderItemIds = Array.from(new Set(matchingOrderItemIds));
  let fulfillmentOrderItemIds: string[] = [];

  if (activeOrderFulfillmentStatus === "needs_fulfillment") {
    const { data } = await supabase
      .from("merch_order_items")
      .select("order_id")
      .is("seller_fulfilled_at", null)
      .limit(500)
      .returns<{ order_id: string }[]>();

    fulfillmentOrderItemIds = data?.map((item) => item.order_id) ?? [];
  } else if (activeOrderFulfillmentStatus === "seller_fulfilled") {
    const { data } = await supabase
      .from("merch_order_items")
      .select("order_id")
      .not("seller_fulfilled_at", "is", null)
      .limit(500)
      .returns<{ order_id: string }[]>();

    fulfillmentOrderItemIds = data?.map((item) => item.order_id) ?? [];
  }

  const uniqueFulfillmentOrderItemIds = Array.from(new Set(fulfillmentOrderItemIds));
  let orderQuery = supabase
    .from("merch_orders")
    .select(
      "id, status, currency, subtotal_cents, platform_fee_cents, shipping_cents, tax_cents, discount_cents, total_cents, customer_email, shipping_name, shipping_address, admin_note, stripe_checkout_session_id, stripe_payment_intent_id, created_at, fulfilled_at, cancelled_at, refunded_at, profiles:profiles!merch_orders_buyer_id_fkey(display_name, username), merch_order_items(id, title_snapshot, quantity, seller_fulfilled_at, tracking_carrier, tracking_number, tracking_url)",
      { count: "exact" },
    );

  if (activeOrderStatus) {
    orderQuery = orderQuery.eq("status", activeOrderStatus);
  }
  if (activeOrderFulfillmentStatus) {
    orderQuery = orderQuery.in(
      "id",
      uniqueFulfillmentOrderItemIds.length ? uniqueFulfillmentOrderItemIds : [impossibleUuid],
    );

    if (activeOrderFulfillmentStatus === "needs_fulfillment") {
      orderQuery = orderQuery.eq("status", "paid");
    }
  }
  if (activeSearch) {
    const orderSearchFields = [
      `customer_email.ilike.%${activeSearch}%`,
      `shipping_name.ilike.%${activeSearch}%`,
      `stripe_checkout_session_id.ilike.%${activeSearch}%`,
      `stripe_payment_intent_id.ilike.%${activeSearch}%`,
    ];

    if (uniqueMatchingOrderItemIds.length > 0) {
      orderSearchFields.push(`id.in.(${uniqueMatchingOrderItemIds.join(",")})`);
    }

    orderQuery = orderQuery.or(
      orderSearchFields.join(","),
    );
  }

  const { count: orderCount, data: orderRows } = await orderQuery
    .order("created_at", { ascending: false })
    .range(orderFrom, orderTo)
    .returns<
      {
        admin_note: string | null;
        cancelled_at: string | null;
        created_at: string;
        currency: string;
        customer_email: string | null;
        discount_cents: number;
        fulfilled_at: string | null;
        id: string;
        merch_order_items: {
          id: string;
          quantity: number;
          seller_fulfilled_at: string | null;
          title_snapshot: string;
          tracking_carrier: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
        }[];
        platform_fee_cents: number;
        profiles: { display_name: string; username: string } | null;
        refunded_at: string | null;
        shipping_address: Record<string, unknown> | null;
        shipping_cents: number;
        shipping_name: string | null;
        status: string;
        stripe_checkout_session_id: string | null;
        stripe_payment_intent_id: string | null;
        subtotal_cents: number;
        tax_cents: number;
        total_cents: number;
      }[]
    >();
  const orders: MerchOrder[] = (orderRows ?? []).map((order) => ({
    adminNote: order.admin_note,
    buyerName: order.profiles?.display_name ?? "Buyer",
    buyerUsername: order.profiles?.username ?? "buyer",
    cancelledAt: order.cancelled_at,
    createdAt: order.created_at,
    currency: order.currency,
    customerEmail: order.customer_email,
    discountCents: order.discount_cents,
    fulfilledAt: order.fulfilled_at,
    id: order.id,
    itemCount: order.merch_order_items.length,
    items: order.merch_order_items.map((item) => ({
      quantity: item.quantity,
      sellerFulfilledAt: item.seller_fulfilled_at,
      title: item.title_snapshot,
      trackingCarrier: item.tracking_carrier,
      trackingNumber: item.tracking_number,
      trackingUrl: item.tracking_url,
    })),
    platformFeeCents: order.platform_fee_cents,
    refundedAt: order.refunded_at,
    shippingAddress: order.shipping_address,
    shippingCents: order.shipping_cents,
    shippingName: order.shipping_name,
    status: order.status,
    stripeCheckoutSessionId: order.stripe_checkout_session_id,
    stripePaymentIntentId: order.stripe_payment_intent_id,
    subtotalCents: order.subtotal_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
  }));
  const totalOrders = orderCount ?? 0;
  const totalOrderPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const hasNextOrderPage = currentOrderPage < totalOrderPages;
  const currentOrderHref = pageHref({
    orderFulfillmentStatus: activeOrderFulfillmentStatus,
    orderPage: currentOrderPage,
    orderStatus: activeOrderStatus,
    page: currentPage,
    productStatus: activeProductStatus,
    sellerPayoutStatus: activeSellerPayoutStatus,
    search: activeSearch,
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
            <Link
              className="mt-2 inline-flex text-xs font-bold uppercase tracking-wide text-[var(--gold)]"
              href={pageHref({
                orderFulfillmentStatus: "needs_fulfillment",
                page: currentPage,
                productStatus: activeProductStatus,
                sellerPayoutStatus: activeSellerPayoutStatus,
                search: activeSearch,
              })}
            >
              Needs fulfillment:{" "}
              {Intl.NumberFormat("en-US").format(needsFulfillmentItemCount ?? 0)}
            </Link>
          </div>
        </div>

        {productError ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] p-4 text-sm leading-6 text-[var(--muted)]">
            Merch products could not load. Check private data access,
            migrations, or the admin error before reviewing products.
          </p>
        ) : null}

        {params.message ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        {activeProductStatus ||
        activeOrderStatus ||
        activeOrderFulfillmentStatus ||
        activeSellerPayoutStatus ||
        activeSearch ? (
          <div className="mb-4 flex flex-col gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">
              Filtering Merch
              {activeSearch ? (
                <>
                  {" "}by{" "}
                  <span>&ldquo;{activeSearch}&rdquo;</span>
                </>
              ) : null}
              {activeProductStatus ? (
                <>
                  {activeSearch ? " and" : " "} products by{" "}
                  <span className="capitalize">
                    {statusLabel(activeProductStatus)}
                  </span>
                </>
              ) : null}
              {activeSellerPayoutStatus ? (
                <>
                  {activeSearch || activeProductStatus ? " and" : " "} seller payout by{" "}
                  <span>{payoutStatusLabel(activeSellerPayoutStatus)}</span>
                </>
              ) : null}
              {(activeProductStatus ||
                activeSellerPayoutStatus ||
                activeOrderFulfillmentStatus) &&
              activeOrderStatus
                ? " and"
                : null}
              {activeOrderStatus ? (
                <>
                  {" "}orders by{" "}
                  <span className="capitalize">
                    {statusLabel(activeOrderStatus)}
                  </span>
                </>
              ) : null}
              {activeOrderFulfillmentStatus ? (
                <>
                  {activeSearch ||
                  activeProductStatus ||
                  activeSellerPayoutStatus ||
                  activeOrderStatus
                    ? " and"
                    : " "} fulfillment by{" "}
                  <span>{fulfillmentFilterLabel(activeOrderFulfillmentStatus)}</span>
                </>
              ) : null}
            </p>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 font-semibold text-[var(--foreground)]"
              href="/admin/merch"
            >
              Clear filters
            </Link>
          </div>
        ) : null}

        <form
          action="/admin/merch"
          className="mb-4 grid gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          {activeProductStatus ? (
            <input name="product_status" type="hidden" value={activeProductStatus} />
          ) : null}
          {activeOrderStatus ? (
            <input name="order_status" type="hidden" value={activeOrderStatus} />
          ) : null}
          {activeSellerPayoutStatus ? (
            <input name="seller_payout" type="hidden" value={activeSellerPayoutStatus} />
          ) : null}
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold uppercase text-[var(--muted-strong)]">
              Search Merch admin
            </span>
            <input
              className="h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-strong)] focus:border-[var(--foreground)]"
              defaultValue={activeSearch}
              maxLength={80}
              name="q"
              placeholder="Product title, order item, customer email, shipping name, or payment ID"
            />
          </label>
          <button className="h-11 self-end rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
            Search
          </button>
        </form>

        <div className="mb-4 grid gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm xl:grid-cols-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-[var(--muted-strong)]">
              Product status
            </p>
            <div className="flex flex-wrap gap-2">
              {productStatusFilters.map((status) => (
                <Link
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                    activeProductStatus === status
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                  }`}
                  href={pageHref({
                    orderFulfillmentStatus: activeOrderFulfillmentStatus,
                    orderStatus: activeOrderStatus,
                    page: 1,
                    productStatus: status,
                    sellerPayoutStatus: activeSellerPayoutStatus,
                    search: activeSearch,
                  })}
                  key={status}
                >
                  {statusLabel(status)}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-[var(--muted-strong)]">
              Seller payout
            </p>
            <div className="flex flex-wrap gap-2">
              {sellerPayoutFilters.map((status) => (
                <Link
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                    activeSellerPayoutStatus === status
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                  }`}
                  href={pageHref({
                    orderFulfillmentStatus: activeOrderFulfillmentStatus,
                    orderStatus: activeOrderStatus,
                    page: 1,
                    productStatus: activeProductStatus,
                    sellerPayoutStatus: status,
                    search: activeSearch,
                  })}
                  key={status}
                >
                  {payoutStatusLabel(status)}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-[var(--muted-strong)]">
              Order status
            </p>
            <div className="flex flex-wrap gap-2">
              {orderStatusFilters.map((status) => (
                <Link
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                    activeOrderStatus === status
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                  }`}
                  href={pageHref({
                    orderStatus: status,
                    page: currentPage,
                    productStatus: activeProductStatus,
                    sellerPayoutStatus: activeSellerPayoutStatus,
                    search: activeSearch,
                  })}
                  key={status}
                >
                  {statusLabel(status)}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-[var(--muted-strong)]">
              Fulfillment
            </p>
            <div className="flex flex-wrap gap-2">
              {orderFulfillmentFilters.map((status) => (
                <Link
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                    activeOrderFulfillmentStatus === status
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] text-[var(--foreground)]"
                  }`}
                  href={pageHref({
                    orderFulfillmentStatus: status,
                    page: currentPage,
                    productStatus: activeProductStatus,
                    sellerPayoutStatus: activeSellerPayoutStatus,
                    search: activeSearch,
                  })}
                  key={status}
                >
                  {fulfillmentFilterLabel(status)}
                </Link>
              ))}
            </div>
          </div>
        </div>

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
              pageHref({
                orderFulfillmentStatus: activeOrderFulfillmentStatus,
                orderPage: currentOrderPage,
                orderStatus: activeOrderStatus,
                page: nextPage,
                productStatus: activeProductStatus,
                sellerPayoutStatus: activeSellerPayoutStatus,
                search: activeSearch,
              })
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
                pageHref({
                  orderFulfillmentStatus: activeOrderFulfillmentStatus,
                  orderPage: currentOrderPage,
                  orderStatus: activeOrderStatus,
                  page: nextPage,
                  productStatus: activeProductStatus,
                  sellerPayoutStatus: activeSellerPayoutStatus,
                  search: activeSearch,
                })
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
                Checkout writes paid, failed, expired, and refunded order states here.
              </p>
            </div>
            <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm font-semibold">
              Page {currentOrderPage} of {totalOrderPages}
            </span>
          </div>
          {activeOrderStatus || activeOrderFulfillmentStatus ? (
            <div className="mb-4 flex flex-col gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold">
                Filtering orders by{" "}
                <span className="capitalize">
                  {activeOrderFulfillmentStatus
                    ? fulfillmentFilterLabel(activeOrderFulfillmentStatus)
                    : activeOrderStatus
                      ? statusLabel(activeOrderStatus)
                      : "All orders"}
                </span>
              </p>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 font-semibold text-[var(--foreground)]"
                href={pageHref({
                  page: currentPage,
                  productStatus: activeProductStatus,
                  sellerPayoutStatus: activeSellerPayoutStatus,
                  search: activeSearch,
                })}
              >
                Clear filter
              </Link>
            </div>
          ) : null}
          <Pagination
            currentPage={currentOrderPage}
            hasNextPage={hasNextOrderPage}
            hrefForPage={(nextOrderPage) =>
              pageHref({
                orderFulfillmentStatus: activeOrderFulfillmentStatus,
                orderPage: nextOrderPage,
                orderStatus: activeOrderStatus,
                page: currentPage,
                productStatus: activeProductStatus,
                sellerPayoutStatus: activeSellerPayoutStatus,
                search: activeSearch,
              })
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
              pageHref({
                orderFulfillmentStatus: activeOrderFulfillmentStatus,
                orderPage: nextOrderPage,
                orderStatus: activeOrderStatus,
                  page: currentPage,
                  productStatus: activeProductStatus,
                  sellerPayoutStatus: activeSellerPayoutStatus,
                  search: activeSearch,
                })
              }
              totalPages={totalOrderPages}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
