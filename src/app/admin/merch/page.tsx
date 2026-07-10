import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, CreditCard, Package, ShieldCheck, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};

const viewRoles: UserRole[] = ["moderator", "admin", "owner"];
const merchRules = [
  "Merch is public-buyable brand goods, separate from verified-only professional Stuff.",
  "Artist, studio, vendor, and official TheTattooCore sellers still need approval before listing products.",
  "Do not allow professional equipment, regulated services, unsafe products, counterfeits, adult sexual products, or scratcher-facing supplies.",
  "Build checkout, tax, shipping, refunds, and payment-provider safety rules before accepting public orders.",
] as const;
const buildSteps = [
  ["Seller approval", "Reuse artist, studio, and vendor verification signals, then add merch-specific seller approval."],
  ["Product catalog", "Create product, variant, inventory, image, and moderation tables with 25-item public loading."],
  ["Checkout", "Pick a payment provider, add tax/shipping/refunds, and keep order data separate from social posts."],
  ["Admin operations", "Add paged product review, order lookup, seller health, refund notes, and fraud flags."],
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Merch",
};

export default async function AdminMerchPage() {
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#202020] text-[#171412]">
      <section className="mx-auto min-h-screen w-full max-w-5xl bg-[#ece8df] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#cfc8bd] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to admin dashboard"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
              href="/admin"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#766d62]">
                Admin
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">Merch</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                Planned public-buyable merchandise marketplace and official TTC store.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 text-sm">
            <p className="font-semibold">{profile.display_name}</p>
            <p className="text-xs text-[#766d62]">
              @{profile.username} - {profile.role}
            </p>
          </div>
        </header>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <Package className="size-5 text-[#c8953b]" />
            <p className="mt-3 text-sm text-[#766d62]">Catalog</p>
            <p className="mt-1 text-xl font-bold">Planned</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <Store className="size-5 text-[#c8953b]" />
            <p className="mt-3 text-sm text-[#766d62]">Sellers</p>
            <p className="mt-1 text-xl font-bold">Approval required</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <CreditCard className="size-5 text-[#c8953b]" />
            <p className="mt-3 text-sm text-[#766d62]">Checkout</p>
            <p className="mt-1 text-xl font-bold">Not live yet</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5">
            <h2 className="text-lg font-bold">Build path</h2>
            <div className="mt-4 grid gap-3">
              {buildSteps.map(([label, body]) => (
                <article
                  className="rounded-md border border-[#e5ded4] bg-white p-3"
                  key={label}
                >
                  <p className="text-xs font-bold uppercase text-[#766d62]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#4f473f]">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="size-5 text-[#c8953b]" />
                <h2 className="text-lg font-bold">Rules</h2>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-[#4f473f]">
                {merchRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>

            <section className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-5">
              <h2 className="text-lg font-bold">Allowed examples</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {["T-shirts", "Prints", "Art", "Stickers", "Official TTC merch"].map(
                  (item) => (
                    <span
                      className="rounded-md border border-[#e5ded4] bg-white px-2.5 py-1.5 text-xs font-semibold"
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
      </section>
    </main>
  );
}
