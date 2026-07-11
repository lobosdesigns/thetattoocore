import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Gavel } from "lucide-react";
import { moderateContent } from "../actions";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
};
type ModerationStatus = "active" | "under_review" | "hidden" | "removed";
type ContentType = "feed_post" | "thread_post" | "marketplace_listing" | "gig";
type ReviewItem = {
  authorName: string;
  authorUsername: string;
  body: string | null;
  createdAt: string;
  id: string;
  isSensitive: boolean;
  sensitiveReason: string | null;
  status: ModerationStatus;
  subjectType: ContentType;
  title: string;
  visibility: "public_preview" | "members" | "private";
};

const moderateRoles: UserRole[] = ["moderator", "admin", "owner"];
const pageSize = 50;
const contentTabs = [
  ["feed_post", "4U"],
  ["thread_post", "Gossip"],
  ["marketplace_listing", "Stuff"],
  ["gig", "Gigs"],
] as const;

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Admin Content",
};

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function contentType(value: string | string[] | undefined): ContentType {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (
    rawValue === "feed_post" ||
    rawValue === "thread_post" ||
    rawValue === "marketplace_listing" ||
    rawValue === "gig"
  ) {
    return rawValue;
  }

  return "feed_post";
}

function pageHref(type: ContentType, page: number) {
  return `/admin/content?type=${type}&page=${page}`;
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function statusLabel(status: ModerationStatus) {
  return status.replace("_", " ");
}

function contentTypeLabel(type: ContentType) {
  if (type === "feed_post") return "4U";
  if (type === "thread_post") return "Gossip";
  if (type === "marketplace_listing") return "Stuff";

  return "Gigs";
}

function Pagination({
  currentPage,
  hasNextPage,
  totalPages,
  type,
}: {
  currentPage: number;
  hasNextPage: boolean;
  totalPages: number;
  type: ContentType;
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
          href={pageHref(type, Math.max(1, currentPage - 1))}
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
          href={pageHref(type, currentPage + 1)}
        >
          Next 50
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function ReviewCard({
  currentPage,
  item,
}: {
  currentPage: number;
  item: ReviewItem;
}) {
  return (
    <article className="ttc-card min-w-0 overflow-hidden rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0 break-words">
          <p className="truncate text-base font-bold">{item.title}</p>
          <p className="mt-1 text-xs text-[#766d62]">
            @{item.authorUsername} - {timeAgo(item.createdAt)}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold capitalize text-[#4f473f]">
          {statusLabel(item.status)}
        </span>
      </div>
      {item.body ? (
        <p className="line-clamp-3 text-sm leading-6 text-[#4f473f]">
          {item.body}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-white px-2 py-1 text-xs font-medium">
          {contentTypeLabel(item.subjectType)}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-medium capitalize">
          {item.visibility.replace("_", " ")}
        </span>
        {item.isSensitive ? (
          <span className="rounded-md bg-[#f6dfdf] px-2 py-1 text-xs font-semibold text-[#8a2828]">
            Sensitive: {item.sensitiveReason?.replaceAll("_", " ") ?? "body art"}
          </span>
        ) : null}
      </div>
      <form action={moderateContent} className="mt-4 space-y-2">
        <input name="return_to" type="hidden" value={pageHref(item.subjectType, currentPage)} />
        <input name="subject_id" type="hidden" value={item.id} />
        <input name="subject_type" type="hidden" value={item.subjectType} />
        <input
          className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
          maxLength={500}
          name="note"
          placeholder="Moderator note"
        />
        <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
          {[
            ["under_review", "Review"],
            ["hidden", "Hide"],
            ["removed", "Remove"],
            ["active", "Restore"],
          ].map(([value, label]) => (
            <button
              className="h-10 rounded-md border border-[#d8d1c6] bg-white px-2 text-sm font-semibold hover:bg-[#f7f4ef]"
              key={value}
              name="moderation_status"
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

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; page?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const activeType = contentType(params.type);
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

  let totalItems = 0;
  let items: ReviewItem[] = [];

  if (activeType === "feed_post") {
    const { count, data } = await supabase
      .from("feed_posts")
      .select(
        "id, caption, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!feed_posts_author_id_fkey(display_name, username)",
        { count: "exact" },
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<
        {
          caption: string | null;
          created_at: string;
          id: string;
          is_sensitive: boolean;
          moderation_status: ModerationStatus;
          profiles: { display_name: string; username: string } | null;
          sensitive_reason: string | null;
          visibility: "public_preview" | "members" | "private";
        }[]
      >();
    totalItems = count ?? 0;
    items = (data ?? []).map((post) => ({
      authorName: post.profiles?.display_name ?? "Member",
      authorUsername: post.profiles?.username ?? "member",
      body: post.caption,
      createdAt: post.created_at,
      id: post.id,
      isSensitive: post.is_sensitive,
      sensitiveReason: post.sensitive_reason,
      status: post.moderation_status,
      subjectType: "feed_post",
      title: post.caption || "4U post",
      visibility: post.visibility,
    }));
  } else if (activeType === "thread_post") {
    const { count, data } = await supabase
      .from("thread_posts")
      .select(
        "id, body, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!thread_posts_author_id_fkey(display_name, username)",
        { count: "exact" },
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<
        {
          body: string;
          created_at: string;
          id: string;
          is_sensitive: boolean;
          moderation_status: ModerationStatus;
          profiles: { display_name: string; username: string } | null;
          sensitive_reason: string | null;
          visibility: "public_preview" | "members" | "private";
        }[]
      >();
    totalItems = count ?? 0;
    items = (data ?? []).map((thread) => ({
      authorName: thread.profiles?.display_name ?? "Member",
      authorUsername: thread.profiles?.username ?? "member",
      body: thread.body,
      createdAt: thread.created_at,
      id: thread.id,
      isSensitive: thread.is_sensitive,
      sensitiveReason: thread.sensitive_reason,
      status: thread.moderation_status,
      subjectType: "thread_post",
      title: "Gossip post",
      visibility: thread.visibility,
    }));
  } else if (activeType === "marketplace_listing") {
    const { count, data } = await supabase
      .from("marketplace_listings")
      .select(
        "id, title, description, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!marketplace_listings_seller_id_fkey(display_name, username)",
        { count: "exact" },
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<
        {
          created_at: string;
          description: string | null;
          id: string;
          is_sensitive: boolean;
          moderation_status: ModerationStatus;
          profiles: { display_name: string; username: string } | null;
          sensitive_reason: string | null;
          title: string;
          visibility: "public_preview" | "members" | "private";
        }[]
      >();
    totalItems = count ?? 0;
    items = (data ?? []).map((listing) => ({
      authorName: listing.profiles?.display_name ?? "Seller",
      authorUsername: listing.profiles?.username ?? "seller",
      body: listing.description,
      createdAt: listing.created_at,
      id: listing.id,
      isSensitive: listing.is_sensitive,
      sensitiveReason: listing.sensitive_reason,
      status: listing.moderation_status,
      subjectType: "marketplace_listing",
      title: listing.title,
      visibility: listing.visibility,
    }));
  } else {
    const { count, data } = await supabase
      .from("gigs")
      .select(
        "id, title, description, created_at, is_sensitive, sensitive_reason, moderation_status, visibility, profiles:profiles!gigs_poster_id_fkey(display_name, username)",
        { count: "exact" },
      )
      .or("is_sensitive.eq.true,moderation_status.neq.active")
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<
        {
          created_at: string;
          description: string | null;
          id: string;
          is_sensitive: boolean;
          moderation_status: ModerationStatus;
          profiles: { display_name: string; username: string } | null;
          sensitive_reason: string | null;
          title: string;
          visibility: "public_preview" | "members" | "private";
        }[]
      >();
    totalItems = count ?? 0;
    items = (data ?? []).map((gig) => ({
      authorName: gig.profiles?.display_name ?? "Member",
      authorUsername: gig.profiles?.username ?? "member",
      body: gig.description,
      createdAt: gig.created_at,
      id: gig.id,
      isSensitive: gig.is_sensitive,
      sensitiveReason: gig.sensitive_reason,
      status: gig.moderation_status,
      subjectType: "gig",
      title: gig.title,
      visibility: gig.visibility,
    }));
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const hasNextPage = currentPage < totalPages;
  const activeCount = items.filter((item) => item.status === "active").length;
  const underReviewCount = items.filter((item) => item.status === "under_review").length;
  const restrictedCount = items.filter(
    (item) => item.status === "hidden" || item.status === "removed" || item.isSensitive,
  ).length;

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <section className="ttc-page-panel mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
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
              <h1 className="text-2xl font-bold sm:text-3xl">Content</h1>
              <p className="mt-1 text-sm text-[#766d62]">
                50 {contentTypeLabel(activeType)} review items per page.
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

        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-2">
          {contentTabs.map(([type, label]) => (
            <Link
              className={`flex h-10 shrink-0 items-center rounded-md border px-3 text-sm font-bold ${
                activeType === type
                  ? "border-[#171412] bg-[#171412] text-white"
                  : "border-[#d8d1c6] bg-white text-[#4f473f]"
              }`}
              href={pageHref(type, 1)}
              key={type}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Total in filter</p>
            <p className="mt-2 text-3xl font-bold">
              {Intl.NumberFormat("en-US").format(totalItems)}
            </p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Active here</p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Review here</p>
            <p className="mt-2 text-3xl font-bold">{underReviewCount}</p>
          </div>
          <div className="ttc-card rounded-lg border border-[#cfc8bd] bg-[#fffdf9] p-4">
            <p className="text-sm text-[#766d62]">Restricted here</p>
            <p className="mt-2 text-3xl font-bold">{restrictedCount}</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 text-sm leading-6 text-[#4f473f]">
          <Gavel className="mt-1 size-5 shrink-0 text-[#c8953b]" />
          <p>
            Review sensitive, hidden, removed, or under-review content by type.
            Use reports for user-submitted abuse context; use this page for
            direct content state cleanup and audit notes.
          </p>
        </div>

        <Pagination
          currentPage={currentPage}
          hasNextPage={hasNextPage}
          totalPages={totalPages}
          type={activeType}
        />

        {items.length ? (
          <section className="mt-4 grid gap-4">
            {items.map((item) => (
              <ReviewCard currentPage={currentPage} item={item} key={item.id} />
            ))}
          </section>
        ) : (
          <p className="mt-4 rounded-md border border-[#e5ded4] bg-[#fffdf9] p-4 text-sm text-[#4f473f]">
            No {contentTypeLabel(activeType)} items are waiting in this content
            review filter.
          </p>
        )}

        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            totalPages={totalPages}
            type={activeType}
          />
        </div>
      </section>
    </main>
  );
}
