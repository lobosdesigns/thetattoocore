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
import { updateMerchProductStatus } from "../actions";
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
type MerchProduct = {
  category: string;
  createdAt: string;
  currency: string;
  id: string;
  inventoryQuantity: number;
  isOfficial: boolean;
  priceCents: number;
  sellerName: string;
  sellerUsername: string;
  status: ProductStatus;
  title: string;
};
type MerchOrder = {
  buyerName: string;
  buyerUsername: string;
  createdAt: string;
  currency: string;
  id: string;
  itemCount: number;
  status: string;
  totalCents: number;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const merchRules = [
  "Merch is public-buyable brand goods, separate from verified-only professional Stuff.",
  "Artist, studio, vendor, and official TheTattooCore sellers still need approval before listing products.",
  "Do not allow professional equipment, regulated services, unsafe products, counterfeits, adult sexual products, or scratcher-facing supplies.",
  "Build checkout, tax, shipping, refunds, and payment-provider safety rules before accepting public orders.",
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
    "Next payment step is Stripe checkout sessions, webhooks, order status, refunds, taxes, and receipts.",
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

function pageHref(page: number) {
  return `/admin/merch?page=${page}`;
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

function Pagination({
  currentPage,
  hasNextPage,
  totalPages,
}: {
  currentPage: number;
  hasNextPage: boolean;
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
          href={pageHref(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous 50
        </Link>
        <Link
          aria-disabled={!hasNextPage}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            !hasNextPage
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
          }`}
          href={pageHref(currentPage + 1)}
        >
          Next 50
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function ProductCard({
  currentPage,
  product,
}: {
  currentPage: number;
  product: MerchProduct;
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
          {product.isOfficial ? (
            <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-2 py-1 text-xs font-semibold">
              Official TTC
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
          <dd>{product.sellerName}</dd>
        </div>
      </dl>
      <form action={updateMerchProductStatus} className="mt-4 space-y-2">
        <input name="product_id" type="hidden" value={product.id} />
        <input name="return_to" type="hidden" value={pageHref(currentPage)} />
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

function OrderCard({ order }: { order: MerchOrder }) {
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
      <dl className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Buyer</dt>
          <dd>{order.buyerName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Items</dt>
          <dd>{Intl.NumberFormat("en-US").format(order.itemCount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">Total</dt>
          <dd>{money(order.totalCents, order.currency)}</dd>
        </div>
      </dl>
    </article>
  );
}

export default async function AdminMerchPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const currentPage = pageNumber(params.page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
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
      "id, title, category, status, price_cents, currency, inventory_quantity, is_official, created_at, profiles:profiles!merch_products_seller_id_fkey(display_name, username)",
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
        price_cents: number;
        profiles: { display_name: string; username: string } | null;
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
    priceCents: product.price_cents,
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
  const { count: orderCount, data: orderRows } = await supabase
    .from("merch_orders")
    .select(
      "id, status, currency, total_cents, created_at, profiles:profiles!merch_orders_buyer_id_fkey(display_name, username), merch_order_items(id)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(0, 9)
    .returns<
      {
        created_at: string;
        currency: string;
        id: string;
        merch_order_items: { id: string }[];
        profiles: { display_name: string; username: string } | null;
        status: string;
        total_cents: number;
      }[]
    >();
  const orders: MerchOrder[] = (orderRows ?? []).map((order) => ({
    buyerName: order.profiles?.display_name ?? "Buyer",
    buyerUsername: order.profiles?.username ?? "buyer",
    createdAt: order.created_at,
    currency: order.currency,
    id: order.id,
    itemCount: order.merch_order_items.length,
    status: order.status,
    totalCents: order.total_cents,
  }));

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

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="mt-3 text-sm text-[var(--muted-strong)]">Orders</p>
            <p className="mt-1 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(orderCount ?? 0)}
            </p>
          </div>
        </div>

        {productError ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] p-4 text-sm leading-6 text-[var(--muted)]">
            Merch database tables are not live in Supabase yet. Apply the merch foundation
            migration before products can appear here.
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
            totalPages={totalPages}
          />

          {products.length ? (
            <div className="mt-4 grid gap-4">
              {products.map((product) => (
                <ProductCard
                  currentPage={currentPage}
                  key={product.id}
                  product={product}
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
              totalPages={totalPages}
            />
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Recent Orders</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Stripe will write checkout results here once payments are connected.
              </p>
            </div>
            <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-sm font-semibold">
              First 10
            </span>
          </div>
          {orders.length ? (
            <div className="grid gap-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-4 text-sm text-[var(--muted)]">
              No orders yet.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
