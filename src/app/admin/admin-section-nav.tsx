import Link from "next/link";
import {
  BriefcaseBusiness,
  Flag,
  ImageIcon,
  Mail,
  Megaphone,
  Package,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";

const adminSections = [
  [Users, "Users", "/admin/users"],
  [ShieldCheck, "Verification", "/admin/verification"],
  [Flag, "Reports", "/admin/reports"],
  [ImageIcon, "Content", "/admin/content"],
  [ShoppingBag, "Stuff", "/admin/stuff"],
  [BriefcaseBusiness, "Gigs", "/admin/gigs"],
  [Package, "Merch", "/admin/merch"],
  [Megaphone, "Ads", "/admin/ads"],
  [ImageIcon, "Media Ops", "/admin/media-ops"],
  [Mail, "Mail", "/admin/mail-settings"],
  [Trash2, "Data", "/admin/data-requests"],
] as const;

export function AdminSectionNav({ activeHref }: { activeHref: string }) {
  return (
    <nav
      aria-label="Admin sections"
      className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-[var(--card-rim)] px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
    >
      {adminSections.map(([Icon, label, href]) => {
        const isActive = activeHref === href;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-bold shadow-sm ${
              isActive
                ? "border-[color-mix(in_srgb,var(--gold)_60%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_18%,var(--paper-warm))] text-[var(--foreground)]"
                : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] text-[var(--muted)] hover:border-[var(--gold)] hover:text-[var(--foreground)]"
            }`}
            href={href}
            key={href}
          >
            <Icon className="size-4 text-[var(--gold)]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
