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
  LinkIcon,
  Megaphone,
  MapPin,
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

type SettingsGroup = {
  description: string;
  href: string;
  icon: typeof UserRound;
  label: string;
};

const memberSettingsGroups: SettingsGroup[] = [
  {
    description: "Identity, profile photo, banner, bio, and public profile basics.",
    href: "/settings/profile",
    icon: UserRound,
    label: "Profile",
  },
  {
    description: "City, region, and local discovery controls.",
    href: "/settings/location",
    icon: MapPin,
    label: "Location",
  },
  {
    description: "Preferred language signal for account and discovery context.",
    href: "/settings/language",
    icon: Languages,
    label: "Language",
  },
  {
    description: "Website, social profiles, and shop links.",
    href: "/settings/socials",
    icon: LinkIcon,
    label: "Social links",
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
    description: "Booking requests, availability, deposits, and calendar setup.",
    href: "/settings/bookings",
    icon: BriefcaseBusiness,
    label: "Bookings",
  },
  {
    description: "Orders, receipts, refunds, and support handoffs.",
    href: "/settings/orders",
    icon: CreditCard,
    label: "Orders",
  },
  {
    description: "Guides, support, data controls, and account deletion requests.",
    href: "/settings/help",
    icon: CircleHelp,
    label: "Help and data",
  },
];

const professionalSettingsGroups: SettingsGroup[] = [
  {
    description: "Professional license or business proof and review status.",
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
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect("/login?return_to=%2Fsettings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, banned_at, license_verified_at, suspended_at")
    .eq("id", data.claims.sub)
    .maybeSingle<{
      account_type: string | null;
      banned_at: string | null;
      license_verified_at: string | null;
      suspended_at: string | null;
    }>();
  const isProfessionalAccount = Boolean(
    profile?.account_type &&
      ["artist", "studio", "vendor"].includes(profile.account_type),
  );
  const canOpenAds =
    isProfessionalAccount &&
    Boolean(profile?.license_verified_at) &&
    !profile?.suspended_at &&
    !profile?.banned_at;
  const settingsGroups = [
    ...memberSettingsGroups.map((group) =>
      group.href === "/settings/orders" && isProfessionalAccount
        ? {
            ...group,
            description:
              "Orders, seller tools, payout readiness, fulfillment, and support handoffs.",
            label: "Orders and payouts",
          }
        : group,
    ),
    ...(isProfessionalAccount
      ? professionalSettingsGroups.filter(
          (group) => group.href !== "/settings/ads" || canOpenAds,
        )
      : []),
  ];

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden px-4 py-6">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            className="ttc-surface inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold"
            href="/#feed"
          >
            <Home aria-hidden="true" className="size-4" />
            4U Home
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
            Profile, privacy, notifications, bookings, orders, and Help each
            have their own door. Language and social links have direct shortcuts
            for quicker mobile edits. Professional tools appear when your account is
            eligible, so mobile settings do not turn into one long scroll.
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
