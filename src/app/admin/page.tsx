import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Flag,
  Gavel,
  ImageIcon,
  Mail,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
  email?: string;
};

const adminTabs = [
  [Activity, "Overview"],
  [Users, "Users"],
  [Flag, "Reports"],
  [ImageIcon, "Content"],
  [ShoppingBag, "Marketplace"],
  [Mail, "Mail Settings"],
] as const;

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];

function formatCount(value: number | null) {
  return value == null ? "0" : Intl.NumberFormat("en-US").format(value);
}

export default async function AdminPage() {
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

  if (!profile || !moderateRoles.includes(profile.role)) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-[#171412]">
        <section className="mx-auto w-full max-w-2xl rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[#171412] text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin access required</h1>
              <p className="text-sm text-[#766d62]">{claims.email}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[#4f473f]">
            This account is signed in, but it has not been assigned an admin or
            moderator role yet.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              href="/account"
            >
              Open profile
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
              href="/"
            >
              Back to site
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const adminProfile = profile;

  const [
    { count: userCount },
    { count: openReports },
    { count: marketplaceQueue },
    { count: moderationActions },
    { data: mailSettings },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("content_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("marketplace_listings")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "active"]),
    supabase
      .from("moderation_actions")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("mail_settings")
      .select(
        "provider, from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
      )
      .maybeSingle<{
        provider: string;
        from_email: string | null;
        from_name: string;
        smtp_host: string | null;
        smtp_port: number | null;
        smtp_username: string | null;
        smtp_secure: boolean;
        smtp_password_secret_name: string;
        reply_to_email: string | null;
        is_enabled: boolean;
      }>(),
  ]);

  const metrics = [
    ["Members", userCount, "Profiles created"],
    ["Open reports", openReports, "Needs review"],
    ["Listings", marketplaceQueue, "Draft and active"],
    ["Actions", moderationActions, "Moderation log"],
  ];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#171412]">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#d8d1c6] bg-[#fffdf9] px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[#171412] text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">Admin</p>
              <p className="text-xs text-[#766d62]">TheTattooCore</p>
            </div>
          </div>

          <nav className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {adminTabs.map(([Icon, label]) => (
              <a
                className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-[#f7f4ef]"
                href={`#${label.toLowerCase().replaceAll(" ", "-")}`}
                key={label}
              >
                <Icon className="size-5" />
                {label}
              </a>
            ))}
          </nav>

          <div className="mt-6 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3">
            <p className="text-sm font-semibold">{adminProfile.display_name}</p>
            <p className="text-xs text-[#766d62]">
              @{adminProfile.username} - {adminProfile.role}
            </p>
          </div>
        </aside>

        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-[#d8d1c6] pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin dashboard</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                Moderation, user safety, marketplace review, and mail setup.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                className="flex h-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                href="/"
              >
                Site
              </Link>
              <Link
                className="flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                href="/account"
              >
                Account
              </Link>
            </div>
          </header>

          <section
            className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            id="overview"
          >
            {metrics.map(([label, value, caption]) => (
              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-4"
                key={label as string}
              >
                <p className="text-sm text-[#766d62]">{caption as string}</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatCount(value as number | null)}
                </p>
                <p className="mt-1 text-sm font-semibold">{label as string}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="space-y-5">
              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="users"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Users className="size-5" />
                  <h2 className="text-lg font-bold">Users and roles</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {["owner", "admin", "moderator", "user"].map((role) => (
                    <div
                      className="rounded-md border border-[#e5ded4] bg-white p-3"
                      key={role}
                    >
                      <p className="text-sm font-semibold capitalize">{role}</p>
                      <p className="mt-1 text-xs text-[#766d62]">
                        Role assignment is stored on profile records.
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="reports"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Flag className="size-5" />
                  <h2 className="text-lg font-bold">Report queue</h2>
                </div>
                <div className="rounded-md border border-[#e5ded4] bg-white p-4 text-sm text-[#4f473f]">
                  Open reports will appear here once reporting controls are
                  added to posts, profiles, marketplace listings, messages, and
                  threads.
                </div>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="content"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Gavel className="size-5" />
                  <h2 className="text-lg font-bold">Content moderation</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Feed posts", "Thread posts", "Comments"].map((label) => (
                    <button
                      className="h-12 rounded-md border border-[#d8d1c6] bg-white px-3 text-left text-sm font-semibold"
                      key={label}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="marketplace"
              >
                <div className="mb-4 flex items-center gap-3">
                  <ShoppingBag className="size-5" />
                  <h2 className="text-lg font-bold">Marketplace</h2>
                </div>
                <p className="text-sm leading-6 text-[#4f473f]">
                  Marketplace review will cover flash sheets, guest spots,
                  studio chairs, supplies, and service listings.
                </p>
              </div>

              <div
                className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
                id="mail-settings"
              >
                <div className="mb-4 flex items-center gap-3">
                  <Mail className="size-5" />
                  <h2 className="text-lg font-bold">Mail settings</h2>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">Provider</dt>
                    <dd className="font-semibold capitalize">
                      {mailSettings?.provider ?? "hostgator"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">From name</dt>
                    <dd className="font-semibold">
                      {mailSettings?.from_name ?? "TheTattooCore"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">SMTP host</dt>
                    <dd className="font-semibold">
                      {mailSettings?.smtp_host ?? "Not set"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">Secret</dt>
                    <dd className="font-semibold">
                      {mailSettings?.smtp_password_secret_name ??
                        "HOSTGATOR_SMTP_PASSWORD"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#766d62]">Enabled</dt>
                    <dd className="font-semibold">
                      {mailSettings?.is_enabled ? "Yes" : "No"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Settings className="size-5" />
                  <h2 className="text-lg font-bold">Next controls</h2>
                </div>
                <div className="space-y-2 text-sm text-[#4f473f]">
                  <p>Role editor</p>
                  <p>Report detail workflow</p>
                  <p>SMTP test email</p>
                  <p>Audit log explorer</p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
