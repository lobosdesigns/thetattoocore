import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck, Trash2 } from "lucide-react";
import { updateAccountDeletionRequest } from "../actions";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type AccountDeletionRequest = {
  id: string;
  profileName: string;
  profileUsername: string;
  reason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  status: "pending" | "reviewing" | "completed" | "rejected" | "cancelled";
};

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Data Requests",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number) {
  return `/admin/data-requests?page=${page}`;
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not provided";
}

function accountDeletionStatusClass(status: AccountDeletionRequest["status"]) {
  if (status === "completed") {
    return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";
  }
  if (status === "rejected" || status === "cancelled") {
    return "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]";
  }
  if (status === "reviewing") {
    return "border-[#b7c6e8] bg-[#eef3ff] text-[#284f8a]";
  }

  return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
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
    <div className="flex flex-col gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[#4f473f]">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={currentPage <= 1}
          className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            currentPage <= 1
              ? "pointer-events-none border-[#e5ded4] bg-[#f7f4ef] text-[#a69b8d]"
              : "border-[#cfc8bd] bg-white text-[#171412]"
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
              ? "pointer-events-none border-[#e5ded4] bg-[#f7f4ef] text-[#a69b8d]"
              : "border-[#171412] bg-[#171412] text-white"
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

function AccountDeletionRequestCard({
  currentPage,
  request,
}: {
  currentPage: number;
  request: AccountDeletionRequest;
}) {
  const isOpen = request.status === "pending" || request.status === "reviewing";

  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-base font-bold">{request.profileName}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{request.profileUsername} - requested {timeAgo(request.requestedAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold capitalize ${accountDeletionStatusClass(
            request.status,
          )}`}
        >
          {request.status}
        </span>
      </div>
      <div className="rounded-md border border-[#e5ded4] bg-white p-3">
        <p className="text-xs font-semibold uppercase text-[#766d62]">
          Member reason
        </p>
        <p className="mt-1 text-sm leading-6 text-[#4f473f]">
          {request.reason || "No reason provided."}
        </p>
      </div>
      <div className="mt-3 rounded-md border border-[#e5ded4] bg-[#f7f4ef] p-3 text-xs leading-5 text-[#4f473f]">
        <p className="font-bold">Manual handling checklist</p>
        <p className="mt-1">
          Confirm identity, review safety or legal holds, preserve required audit
          records, then process the user data removal before marking completed.
        </p>
      </div>
      {isOpen ? (
        <form action={updateAccountDeletionRequest} className="mt-4 space-y-2">
          <input name="request_id" type="hidden" value={request.id} />
          <input name="return_to" type="hidden" value={pageHref(currentPage)} />
          <input
            className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            maxLength={500}
            name="note"
            placeholder="Reviewer note, required to complete or reject"
          />
          <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
            {[
              ["reviewing", "Review"],
              ["completed", "Complete"],
              ["rejected", "Reject"],
              ["cancelled", "Cancel"],
            ].map(([value, label]) => (
              <button
                className={
                  value === "completed"
                    ? "h-10 rounded-md bg-[#171412] px-2 text-sm font-semibold text-white"
                    : value === "rejected"
                      ? "h-10 rounded-md border border-[#e5b8b8] bg-[#fff0f0] px-2 text-sm font-semibold text-[#8a2828] hover:bg-[#f6dfdf]"
                      : "h-10 rounded-md border border-[#d8d1c6] bg-white px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
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
      ) : (
        <div className="mt-4 rounded-md border border-[#e5ded4] bg-[#f7f4ef] px-3 py-2 text-xs text-[#766d62]">
          <p>
            Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : "previously"}.
          </p>
          {request.reviewerNote ? (
            <p className="mt-1 text-[#4f473f]">{request.reviewerNote}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default async function AdminDataRequestsPage({
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

  const { count, data: requestRows } = await supabase
    .from("account_deletion_requests")
    .select(
      "id, reason, status, reviewer_note, requested_at, reviewed_at, profiles:profiles!account_deletion_requests_profile_id_fkey(display_name, username)",
      { count: "exact" },
    )
    .in("status", ["pending", "reviewing", "completed", "rejected", "cancelled"])
    .order("requested_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        id: string;
        profiles: { display_name: string; username: string } | null;
        reason: string | null;
        requested_at: string;
        reviewed_at: string | null;
        reviewer_note: string | null;
        status: "pending" | "reviewing" | "completed" | "rejected" | "cancelled";
      }[]
    >();
  const requests: AccountDeletionRequest[] = (requestRows ?? []).map((request) => ({
    id: request.id,
    profileName: request.profiles?.display_name ?? "Member",
    profileUsername: request.profiles?.username ?? "member",
    reason: request.reason,
    requestedAt: request.requested_at,
    reviewedAt: request.reviewed_at,
    reviewerNote: request.reviewer_note,
    status: request.status,
  }));
  const totalRequests = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize));
  const hasNextPage = currentPage < totalPages;
  const openRequests = requests.filter(
    (request) => request.status === "pending" || request.status === "reviewing",
  );
  const closedRequests = requests.filter(
    (request) => request.status !== "pending" && request.status !== "reviewing",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#202020] text-[#171412]">
      <section className="mx-auto min-h-screen w-full max-w-6xl bg-[#ece8df] px-4 py-6 sm:px-6 lg:px-8">
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
              <h1 className="text-2xl font-bold sm:text-3xl">Data Requests</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                50 requests per page for account deletion, privacy handling, and manual audit checks.
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

        {params.message ? (
          <p className="mb-4 rounded-md border border-[#cfc8bd] bg-[#e8e4dc] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Requests</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalRequests)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Open here</p>
            <p className="mt-2 text-3xl font-bold">{openRequests.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Closed here</p>
            <p className="mt-2 text-3xl font-bold">{closedRequests.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Handling</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="size-5 text-[#c8953b]" />
              Manual review
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 text-sm leading-6 text-[#4f473f]">
          <Trash2 className="mt-1 size-5 shrink-0 text-[#c8953b]" />
          <p>
            Complete and reject actions require a clear reviewer note. Keep
            identity, safety, legal hold, and audit preservation checks outside
            the public profile flow before marking a request complete.
          </p>
        </div>

        <Pagination
          currentPage={currentPage}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
        />

        {requests.length ? (
          <section className="mt-4 grid gap-4">
            {requests.map((request) => (
              <AccountDeletionRequestCard
                currentPage={currentPage}
                key={request.id}
                request={request}
              />
            ))}
          </section>
        ) : (
          <p className="mt-4 rounded-md border border-[#e5ded4] bg-[#fffdf9] p-4 text-sm text-[#4f473f]">
            No account deletion or privacy requests are in this queue yet.
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
    </main>
  );
}
