import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  UserPlus,
  Users,
} from "lucide-react";
import { NotificationBellLink } from "@/app/notification-bell-link";
import { ProfileAvatar } from "@/app/profile-avatar";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";

type Claims = {
  sub: string;
};

type FollowListKind = "followers" | "following";

type Profile = {
  account_type: string;
  avatar_url: string | null;
  banner_url: string | null;
  display_name: string;
  id: string;
  is_private: boolean;
  license_verified_at: string | null;
  username: string;
};

type FollowRecord = {
  status: "accepted" | "pending";
};

type BlockRecord = {
  blocked_id: string;
  blocker_id: string;
};

type FollowListRow = {
  created_at: string;
  profiles: Pick<
    Profile,
    | "account_type"
    | "avatar_url"
    | "banner_url"
    | "display_name"
    | "id"
    | "license_verified_at"
    | "username"
  > | null;
};

const pageSize = 50;

function isVerifiedProfile(
  profile: Pick<Profile, "account_type" | "license_verified_at">,
) {
  return isVerifiedProfessional(profile);
}

function titleFor(kind: FollowListKind) {
  return kind === "followers" ? "Followers" : "Following";
}

function emptyText(kind: FollowListKind) {
  return kind === "followers"
    ? "No followers to show yet."
    : "Not following anyone yet.";
}

function otherKind(kind: FollowListKind): FollowListKind {
  return kind === "followers" ? "following" : "followers";
}

function pageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(username: string, kind: FollowListKind, page: number) {
  return `/u/${username}/${kind}?page=${page}`;
}

async function getBlockedProfileIds({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId?: string | null;
}) {
  if (!userId) return new Set<string>();

  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .returns<BlockRecord[]>();

  return new Set(
    (data ?? []).map((block) =>
      block.blocker_id === userId ? block.blocked_id : block.blocker_id,
    ),
  );
}

function Pagination({
  currentPage,
  hasNextPage,
  kind,
  profileUsername,
  totalPages,
}: {
  currentPage: number;
  hasNextPage: boolean;
  kind: FollowListKind;
  profileUsername: string;
  totalPages: number;
}) {
  return (
    <nav className="ttc-surface flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[var(--muted)]">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Link
          aria-disabled={currentPage <= 1}
          className={`flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            currentPage <= 1
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_74%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "ttc-surface"
          }`}
          href={pageHref(profileUsername, kind, Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Link>
        <Link
          aria-disabled={!hasNextPage}
          className={`flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold ${
            !hasNextPage
              ? "pointer-events-none border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_74%,transparent)] text-[color-mix(in_srgb,var(--muted-strong)_70%,transparent)]"
              : "ttc-control-active border-[var(--foreground)]"
          }`}
          href={pageHref(profileUsername, kind, currentPage + 1)}
        >
          Next 50
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}

export async function FollowListPage({
  kind,
  page,
  username,
}: {
  kind: FollowListKind;
  page?: string | string[];
  username: string;
}) {
  const cleanUsername = username.replace(/^@/, "").toLowerCase();
  const currentPage = pageNumber(page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, banner_url, account_type, is_private, license_verified_at",
    )
    .eq("username", cleanUsername)
    .maybeSingle<Profile>();

  if (!profile) {
    notFound();
  }

  const [
    { count: followerCount },
    { count: followingCount },
    { data: followRecord },
    { data: blockRecord },
    blockedProfileIds,
  ] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id)
        .eq("status", "accepted"),
      claims?.sub
        ? supabase
            .from("follows")
            .select("status")
            .eq("follower_id", claims.sub)
            .eq("following_id", profile.id)
            .maybeSingle<FollowRecord>()
        : Promise.resolve({ data: null }),
      claims?.sub && claims.sub !== profile.id
        ? supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(
              `and(blocker_id.eq.${claims.sub},blocked_id.eq.${profile.id}),and(blocker_id.eq.${profile.id},blocked_id.eq.${claims.sub})`,
            )
            .limit(1)
            .maybeSingle<BlockRecord>()
        : Promise.resolve({ data: null }),
      getBlockedProfileIds({ supabase, userId: claims?.sub }),
    ]);

  const isOwnProfile = claims?.sub === profile.id;
  const hasBlockRelationship = Boolean(blockRecord);
  const canView =
    Boolean(claims?.sub) &&
    !hasBlockRelationship &&
    (!profile.is_private || isOwnProfile || followRecord?.status === "accepted");
  const listQuery =
    kind === "followers"
      ? supabase
          .from("follows")
          .select(
            "created_at, profiles:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, banner_url, account_type, license_verified_at)",
            { count: "exact" },
          )
          .eq("following_id", profile.id)
      : supabase
          .from("follows")
          .select(
            "created_at, profiles:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, banner_url, account_type, license_verified_at)",
            { count: "exact" },
          )
          .eq("follower_id", profile.id);
  const { count: listCount, data: rows } = canView
    ? await listQuery
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .range(from, to)
        .returns<FollowListRow[]>()
    : { count: 0, data: [] as FollowListRow[] };
  const totalRows =
    listCount ?? (kind === "followers" ? followerCount : followingCount) ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const hasNextPage = currentPage < totalPages;
  const visibleRows = (rows ?? []).filter(
    (row) => row.profiles && !blockedProfileIds.has(row.profiles.id),
  );

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-3xl overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to profile"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
                href={`/u/${profile.username}`}
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">
                  {titleFor(kind)}
                </h1>
                <p className="truncate text-xs text-[var(--muted-strong)]">
                  @{profile.username}
                </p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-4 py-5">
          <div
            className="mb-4 h-28 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--foreground)_88%,var(--brand-gold))] bg-cover bg-center shadow-[0_14px_34px_rgba(23,20,18,0.14)]"
            style={
              profile.banner_url
                ? { backgroundImage: `url(${profile.banner_url})` }
                : undefined
            }
          />
          <div className="flex items-center gap-3">
            <ProfileAvatar
              profile={profile}
              className="-mt-10 size-14 border-2 border-[var(--paper-warm)] text-lg shadow-lg"
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-lg font-bold">
                  {profile.display_name}
                </h2>
                {isVerifiedProfile(profile) ? (
                  <BadgeCheck className="size-4 shrink-0" />
                ) : null}
              </div>
              <p className="text-sm text-[var(--muted-strong)]">
                {followerCount ?? 0} followers - {followingCount ?? 0} following
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {(["followers", "following"] as const).map((item) => (
              <Link
                className={`flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-semibold ${
                  item === kind
                    ? "ttc-control-active border-[var(--foreground)]"
                    : "ttc-surface"
                }`}
                href={`/u/${profile.username}/${item}`}
                key={item}
              >
                {titleFor(item)}
              </Link>
            ))}
          </div>
        </section>

        {canView ? (
          <section className="px-4 pt-5">
            <Pagination
              currentPage={currentPage}
              hasNextPage={hasNextPage}
              kind={kind}
              profileUsername={profile.username}
              totalPages={totalPages}
            />
            <p className="mt-3 text-sm text-[var(--muted-strong)]">
              Showing{" "}
              {visibleRows.length ? `${from + 1}-${from + visibleRows.length}` : "0"}{" "}
              of {totalRows} {kind}.
            </p>
          </section>
        ) : null}

        {!canView ? (
          <section className="px-4 py-8">
            <div className="ttc-card rounded-md p-5 text-center">
              <LockKeyhole className="mx-auto mb-3 size-8 text-[var(--muted-strong)]" />
              <h2 className="text-lg font-bold">Private community</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
                Sign in and follow this profile, if needed, to view their full
                community list.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                href={`/u/${profile.username}`}
              >
                Back to profile
              </Link>
            </div>
          </section>
        ) : visibleRows.length ? (
          <section className="grid gap-3 px-4 py-5">
            {visibleRows.map((row) => {
              const person = row.profiles;

              if (!person) return null;

              return (
                <Link
                  className="ttc-card overflow-hidden rounded-md"
                  href={`/u/${person.username}`}
                  key={person.id}
                >
                  <div
                    className="h-16 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--foreground)_88%,var(--brand-gold))] bg-cover bg-center"
                    style={
                      person.banner_url
                        ? { backgroundImage: `url(${person.banner_url})` }
                        : undefined
                    }
                  />
                  <div className="flex items-center gap-3 p-4">
                    <ProfileAvatar
                      className="-mt-8 border-2 border-[var(--paper-warm)] shadow-md"
                      profile={person}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-sm font-bold">
                          {person.display_name}
                        </p>
                        {isVerifiedProfile(person) ? (
                          <BadgeCheck className="size-3.5 shrink-0" />
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--muted-strong)]">
                        @{person.username} - {person.account_type}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
            <Pagination
              currentPage={currentPage}
              hasNextPage={hasNextPage}
              kind={kind}
              profileUsername={profile.username}
              totalPages={totalPages}
            />
          </section>
        ) : (
          <section className="px-4 py-8">
            <div className="ttc-surface rounded-md border border-dashed p-5 text-center">
              {kind === "followers" ? (
                <Users className="mx-auto mb-3 size-8 text-[var(--muted-strong)]" />
              ) : (
                <UserPlus className="mx-auto mb-3 size-8 text-[var(--muted-strong)]" />
              )}
              <h2 className="text-lg font-bold">{emptyText(kind)}</h2>
              <Link
                className="ttc-surface mt-4 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold"
                href={`/u/${profile.username}/${otherKind(kind)}`}
              >
                View {titleFor(otherKind(kind))}
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
