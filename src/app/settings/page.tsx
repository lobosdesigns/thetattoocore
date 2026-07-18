import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Home,
  Languages,
  Megaphone,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Settings",
};

const settingsGroups = [
  {
    description: "Identity, profile photo, banner, bio, social links, and shop links.",
    href: "/settings/profile",
    icon: UserRound,
    label: "Profile",
  },
  {
    description: "City, region, language signal, and local discovery controls.",
    href: "/settings/location",
    icon: Languages,
    label: "Location and language",
  },
  {
    description: "Light, dark, or system appearance.",
    href: "/settings/appearance",
    icon: Palette,
    label: "Appearance",
  },
  {
    description: "Private profile, 18+ confirmation, and location personalization.",
    href: "/settings/privacy",
    icon: ShieldCheck,
    label: "Privacy and safety",
  },
  {
    description: "Alerts, quiet hours, email, and app notification preferences.",
    href: "/settings/notifications",
    icon: Bell,
    label: "Notifications",
  },
  {
    description: "Booking requests, availability, deposits, and calendar prep.",
    href: "/settings/bookings",
    icon: BriefcaseBusiness,
    label: "Bookings",
  },
  {
    description: "Orders, seller tools, payout readiness, and support handoffs.",
    href: "/settings/orders",
    icon: CreditCard,
    label: "Orders and payouts",
  },
  {
    description: "Professional verification documents and review status.",
    href: "/settings/verification",
    icon: ShieldCheck,
    label: "Verification",
  },
  {
    description: "Campaigns, ad credits, review rules, and payment status.",
    href: "/settings/ads",
    icon: Megaphone,
    label: "Advertising",
  },
  {
    description: "Guides, support, data controls, and account deletion requests.",
    href: "/settings/help",
    icon: CircleHelp,
    label: "Help and data",
  },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect("/login?return_to=%2Fsettings");
  }

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden px-4 py-6">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            className="ttc-surface inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold"
            href="/#feed"
          >
            <Home className="size-4" />
            4U
          </Link>
          <Link
            className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-bold"
            href="/account"
          >
            Account
          </Link>
        </div>

        <header className="ttc-card mb-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-5 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
            Settings
          </p>
          <h1 className="mt-1 text-3xl font-black">Choose what to manage</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Profile, privacy, notifications, bookings, payments, verification,
            advertising, and Help each have their own door so mobile settings do
            not turn into one long scroll.
          </p>
        </header>

        <div className="grid gap-3">
          {settingsGroups.map((item) => (
            <Link
              className="ttc-card group flex items-center gap-3 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] p-4 transition hover:border-[color-mix(in_srgb,var(--gold)_58%,var(--card-rim))]"
              href={item.href}
              key={item.href}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--gold)_34%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[var(--gold)]">
                <item.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black">{item.label}</span>
                <span className="mt-1 block text-sm leading-5 text-[var(--muted)]">
                  {item.description}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-[var(--muted-strong)] transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
