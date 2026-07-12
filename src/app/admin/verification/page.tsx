import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { AdminSectionNav } from "../admin-section-nav";
import { updateLicenseVerification } from "../actions";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type LicenseRequest = {
  accountType: string;
  createdAt: string;
  documentName: string;
  expiresOn: string | null;
  id: string;
  issuingRegion: string;
  licenseName: string;
  licenseNumber: string | null;
  profileName: string;
  profileUsername: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  signedDocumentUrl: string | null;
  status: "pending" | "approved" | "rejected";
  storageBucket: string;
};

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const licenseReviewChecklist = [
  "Confirm the account is an artist, studio, or vendor before approval.",
  "Match the document to the profile name, shop, or vendor business.",
  "Reject expired documents and ask the member to resubmit current proof.",
  "Do not approve scratcher activity, unlicensed studios, AI tattoo art claims, or restricted equipment access for unqualified buyers.",
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Verification",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number) {
  return `/admin/verification?page=${page}`;
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

function fileNameFromPath(path: string) {
  const name = path.split("/").filter(Boolean).at(-1);
  return name || "License document";
}

function isExpiredDate(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);

  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function licenseStatusClass(status: LicenseRequest["status"]) {
  if (status === "approved") return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  if (status === "rejected") return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";

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

function LicenseRequestCard({
  currentPage,
  request,
}: {
  currentPage: number;
  request: LicenseRequest;
}) {
  const isPending = request.status === "pending";
  const isExpired = isExpiredDate(request.expiresOn);

  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-base font-bold">{request.profileName}</p>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            @{request.profileUsername} - {request.accountType} -{" "}
            {timeAgo(request.createdAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold capitalize ${licenseStatusClass(
            request.status,
          )}`}
        >
          {request.status}
        </span>
      </div>
      <dl className="grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Certification
          </dt>
          <dd className="mt-0.5">{request.licenseName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Region
          </dt>
          <dd className="mt-0.5">{request.issuingRegion}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Submitted
          </dt>
          <dd className="mt-0.5">{formatDate(request.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
            Expires
          </dt>
          <dd className="mt-0.5">
            {formatDate(request.expiresOn)}
            {isExpired ? (
              <span className="ml-2 rounded-md bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-2 py-0.5 text-xs font-semibold text-[var(--danger)]">
                expired
              </span>
            ) : null}
          </dd>
        </div>
        {request.licenseNumber ? (
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
              License number
            </dt>
            <dd className="mt-0.5">{request.licenseNumber}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] p-3">
        <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
          Review checklist
        </p>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--muted)]">
          {licenseReviewChecklist.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
        <p className="truncate text-sm font-semibold">{request.documentName}</p>
        <p className="mt-1 text-xs text-[var(--muted-strong)]">
          Private file - {request.storageBucket}
        </p>
      </div>
      {request.signedDocumentUrl ? (
        <a
          className="mt-4 flex h-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)]"
          href={request.signedDocumentUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open private document
        </a>
      ) : (
        <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-3 py-2 text-xs text-[var(--muted-strong)]">
          Document link is unavailable. Refresh the queue or check storage
          permissions.
        </p>
      )}
      {isPending ? (
        <form action={updateLicenseVerification} className="mt-4 space-y-2">
          <input name="request_id" type="hidden" value={request.id} />
          <input name="return_to" type="hidden" value={pageHref(currentPage)} />
          <input
            className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            maxLength={500}
            name="note"
            placeholder="Reviewer note, required for rejection"
          />
          {isExpired ? (
            <p className="rounded-md border border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-3 py-2 text-xs leading-5 text-[var(--danger)]">
              This document appears expired. Reject it and ask the member to
              resubmit current proof.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="ttc-disabled-state h-10 rounded-md bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--background)] disabled:border"
              disabled={isExpired}
              name="status"
              value="approved"
            >
              Approve
            </button>
            <button
              className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)]"
              name="status"
              value="rejected"
            >
              Reject
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-3 py-2 text-xs text-[var(--muted-strong)]">
          <p>
            Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : "previously"}.
          </p>
          {request.reviewerNote ? (
            <p className="mt-1 text-[var(--muted)]">{request.reviewerNote}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default async function AdminVerificationPage({
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
    .from("license_verification_requests")
    .select(
      "id, account_type, license_name, license_number, issuing_region, expires_on, storage_bucket, storage_path, status, reviewer_note, reviewed_at, created_at, profiles:profiles!license_verification_requests_profile_id_fkey(display_name, username)",
      { count: "exact" },
    )
    .in("status", ["pending", "approved", "rejected"])
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      {
        account_type: string;
        created_at: string;
        expires_on: string | null;
        id: string;
        issuing_region: string;
        license_name: string;
        license_number: string | null;
        profiles: { display_name: string; username: string } | null;
        reviewed_at: string | null;
        reviewer_note: string | null;
        status: "pending" | "approved" | "rejected";
        storage_bucket: string;
        storage_path: string;
      }[]
    >();
  const signedDocumentUrls = await Promise.all(
    (requestRows ?? []).map(async (request) => {
      const { data } = await supabase.storage
        .from(request.storage_bucket)
        .createSignedUrl(request.storage_path, 300);

      return [request.id, data?.signedUrl ?? null] as const;
    }),
  );
  const signedDocumentUrlByRequest = new Map(signedDocumentUrls);
  const requests: LicenseRequest[] = (requestRows ?? []).map((request) => ({
    accountType: request.account_type,
    createdAt: request.created_at,
    documentName: fileNameFromPath(request.storage_path),
    expiresOn: request.expires_on,
    id: request.id,
    issuingRegion: request.issuing_region,
    licenseName: request.license_name,
    licenseNumber: request.license_number,
    profileName: request.profiles?.display_name ?? "Member",
    profileUsername: request.profiles?.username ?? "member",
    reviewedAt: request.reviewed_at,
    reviewerNote: request.reviewer_note,
    signedDocumentUrl: signedDocumentUrlByRequest.get(request.id) ?? null,
    status: request.status,
    storageBucket: request.storage_bucket,
  }));
  const totalRequests = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize));
  const hasNextPage = currentPage < totalPages;
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const rejectedRequests = requests.filter((request) => request.status === "rejected");

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
              <h1 className="text-2xl font-bold sm:text-3xl">Verification</h1>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">
                50 license, certification, and vendor business submissions per page.
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

        <AdminSectionNav activeHref="/admin/verification" />

        {params.message ? (
          <p className="mb-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_82%,var(--gold)_12%)] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Requests</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalRequests)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Pending here</p>
            <p className="mt-2 text-3xl font-bold">{pendingRequests.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Approved here</p>
            <p className="mt-2 text-3xl font-bold">{approvedRequests.length}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4">
            <p className="text-sm text-[var(--muted-strong)]">Rejected here</p>
            <p className="mt-2 text-3xl font-bold">{rejectedRequests.length}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3 text-sm leading-6 text-[var(--muted)]">
          <ShieldCheck className="mt-1 size-5 shrink-0 text-[var(--gold)]" />
          <p>
            Approvals unlock verified artist, studio, and vendor capabilities.
            Reject expired, mismatched, scratcher, unlicensed, unsafe, or AI-art
            claims and ask the member to resubmit clean proof.
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
              <LicenseRequestCard
                currentPage={currentPage}
                key={request.id}
                request={request}
              />
            ))}
          </section>
        ) : (
          <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 text-sm text-[var(--muted)]">
            No license, certification, or vendor verification submissions are in
            this queue yet.
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
