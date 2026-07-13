import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck, Users } from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import { changeUserRole, changeUserStatus, createTestAccount } from "../actions";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  email?: string;
  sub: string;
};
type AdminUser = {
  accountType: string;
  bannedAt: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  moderationNote: string | null;
  role: UserRole;
  suspendedAt: string | null;
  username: string;
};

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Users",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function userStatus(user: Pick<AdminUser, "bannedAt" | "suspendedAt">) {
  if (user.bannedAt) return "banned";
  if (user.suspendedAt) return "suspended";

  return "active";
}

function pageHref(page: number) {
  return `/admin/users?page=${page}`;
}

function statusClass(user: AdminUser) {
  const status = userStatus(user);

  if (status === "active") return "bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] text-[var(--muted)]";
  if (status === "suspended") return "bg-[color-mix(in_srgb,var(--gold)_22%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";

  return "bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
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

export default async function AdminUsersPage({
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

  if (!profile || !moderateRoles.includes(profile.role)) {
    redirect("/admin");
  }

  const { count, data: userRows } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, account_type, role, banned_at, suspended_at, moderation_note, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        account_type: string;
        banned_at: string | null;
        created_at: string;
        display_name: string;
        id: string;
        moderation_note: string | null;
        role: UserRole;
        suspended_at: string | null;
        username: string;
      }[]
    >();
  const users: AdminUser[] = (userRows ?? []).map((user) => ({
    accountType: user.account_type,
    bannedAt: user.banned_at,
    createdAt: user.created_at,
    displayName: user.display_name,
    id: user.id,
    moderationNote: user.moderation_note,
    role: user.role,
    suspendedAt: user.suspended_at,
    username: user.username,
  }));
  const totalUsers = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const hasNextPage = currentPage < totalPages;
  const canManageRoles = profile.role === "owner";
  const canCreateTestAccounts = canManageRoles && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
              <h1 className="text-2xl font-bold sm:text-3xl">Users</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                50 accounts per page for role, suspension, ban, and moderation-note review.
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

        <AdminSectionNav activeHref="/admin/users" />

        {params.message ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Total accounts</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalUsers)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Showing</p>
            <p className="mt-2 text-3xl font-bold">
              {users.length ? `${from + 1}-${from + users.length}` : "0"}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Role tools</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="size-5 text-[var(--gold)]" />
              {canManageRoles ? "Owner enabled" : "Moderator safety only"}
            </p>
          </div>
        </div>

        <Pagination
          currentPage={currentPage}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
        />

        {!canManageRoles ? (
          <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3 text-sm text-[var(--muted)]">
            Owner role required to promote admins or moderators. Moderators can
            still restore, suspend, ban, and note accounts.
          </p>
        ) : null}

        {canManageRoles ? (
          <section className="ttc-card mt-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-strong)]">
                  Owner tools
                </p>
                <h2 className="mt-1 text-xl font-bold">Create tester account</h2>
                <p className="mt-1 text-sm text-[var(--muted-strong)]">
                  Make confirmed QA or demo users from owner tools.
                </p>
              </div>
              <span
                className={`w-fit rounded-md border px-3 py-2 text-xs font-semibold ${
                  canCreateTestAccounts
                    ? "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_14%,var(--paper-warm))] text-[var(--foreground)]"
                    : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[var(--muted-strong)]"
                }`}
              >
                {canCreateTestAccounts ? "Owner tools ready" : "Owner tools disabled"}
              </span>
            </div>

            <form
              action={createTestAccount}
              className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
            >
              <input name="return_to" type="hidden" value={pageHref(currentPage)} />
              <label className="grid gap-1 text-sm font-semibold">
                Email
                <input
                  className="h-11 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  name="email"
                  placeholder="tester@example.com"
                  required
                  type="email"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Username
                <input
                  className="h-11 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  maxLength={30}
                  minLength={3}
                  name="username"
                  pattern="[a-z0-9_]{3,30}"
                  placeholder="ttc_tester"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Display
                <input
                  className="h-11 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  maxLength={80}
                  name="display_name"
                  placeholder="TTC Tester"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Type
                <select
                  className="h-11 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  defaultValue="enthusiast"
                  name="account_type"
                >
                  {["enthusiast", "artist", "studio", "vendor"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold lg:min-w-44">
                Password
                <input
                  className="h-11 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>
              <button
                className="ttc-disabled-state h-11 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)] disabled:border lg:col-start-5"
                disabled={!canCreateTestAccounts}
              >
                Create
              </button>
            </form>
            {!canCreateTestAccounts ? (
              <p className="mt-3 text-xs font-medium text-[var(--muted-strong)]">
                Enable private owner tools before creating confirmed users here.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-4 grid gap-3">
          {users.map((user) => (
            <article
              className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4"
              key={user.id}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="size-4 text-[var(--gold)]" />
                    <p className="truncate text-base font-bold">
                      {user.displayName}
                    </p>
                    <span className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 py-1 text-xs font-semibold capitalize text-[var(--muted)]">
                      {user.role}
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusClass(
                        user,
                      )}`}
                    >
                      {userStatus(user)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-strong)]">
                    @{user.username} - {user.accountType} - joined{" "}
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                  {user.moderationNote ? (
                    <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
                      {user.moderationNote}
                    </p>
                  ) : null}
                </div>
                <Link
                  className="h-10 w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-4 py-2 text-sm font-semibold"
                  href={`/u/${user.username}`}
                >
                  View profile
                </Link>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                {canManageRoles ? (
                  <form
                    action={changeUserRole}
                    className="grid gap-2 sm:grid-cols-[1fr_auto] lg:grid-cols-1"
                  >
                    <input name="profile_id" type="hidden" value={user.id} />
                    <input name="return_to" type="hidden" value={pageHref(currentPage)} />
                    <select
                      className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                      defaultValue={user.role}
                      name="role"
                    >
                      {["user", "moderator", "admin", "owner"].map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]">
                      Update role
                    </button>
                  </form>
                ) : (
                  <div className="hidden lg:block" />
                )}
                <form action={changeUserStatus} className="grid gap-2">
                  <input name="profile_id" type="hidden" value={user.id} />
                  <input name="return_to" type="hidden" value={pageHref(currentPage)} />
                  <input
                    className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    maxLength={500}
                    name="note"
                    placeholder="Moderation note"
                  />
                  <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
                    {[
                      ["active", "Restore"],
                      ["suspended", "Suspend"],
                      ["banned", "Ban"],
                    ].map(([value, label]) => (
                      <button
                        className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-2 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)]"
                        key={value}
                        name="status"
                        value={value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </form>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            totalPages={totalPages}
          />
        </div>
      </section>
    </main>
  );
}
