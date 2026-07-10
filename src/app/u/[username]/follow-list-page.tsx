import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
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
  display_name: string;
  id: string;
  is_private: boolean;
  license_verified_at: string | null;
  username: string;
};

type FollowRecord = {
  status: "accepted" | "pending";
};

type FollowListRow = {
  created_at: string;
  profiles: Pick<
    Profile,
    | "account_type"
    | "avatar_url"
    | "display_name"
    | "id"
    | "license_verified_at"
    | "username"
  > | null;
};

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

export async function FollowListPage({
  kind,
  username,
}: {
  kind: FollowListKind;
  username: string;
}) {
  const cleanUsername = username.replace(/^@/, "").toLowerCase();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, account_type, is_private, license_verified_at",
    )
    .eq("username", cleanUsername)
    .maybeSingle<Profile>();

  if (!profile) {
    notFound();
  }

  const [{ count: followerCount }, { count: followingCount }, { data: followRecord }] =
    await Promise.all([
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
    ]);

  const isOwnProfile = claims?.sub === profile.id;
  const canView =
    Boolean(claims?.sub) &&
    (!profile.is_private || isOwnProfile || followRecord?.status === "accepted");
  const listQuery =
    kind === "followers"
      ? supabase
          .from("follows")
          .select(
            "created_at, profiles:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, account_type, license_verified_at)",
          )
          .eq("following_id", profile.id)
      : supabase
          .from("follows")
          .select(
            "created_at, profiles:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, account_type, license_verified_at)",
          )
          .eq("follower_id", profile.id);
  const { data: rows } = canView
    ? await listQuery
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<FollowListRow[]>()
    : { data: [] as FollowListRow[] };
  const visibleRows = (rows ?? []).filter((row) => row.profiles);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen w-full max-w-3xl overflow-x-hidden bg-[#f2f1ee] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to profile"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
                href={`/u/${profile.username}`}
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">
                  {titleFor(kind)}
                </h1>
                <p className="truncate text-xs text-[#766d62]">
                  @{profile.username}
                </p>
              </div>
            </div>
            <NotificationBellLink className="shrink-0" userId={claims?.sub} />
          </div>
        </header>

        <section className="border-b border-[#cfc8bd] bg-[#fffdf9] px-4 py-5">
          <div className="flex items-center gap-3">
            <ProfileAvatar profile={profile} className="size-14 text-lg" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-lg font-bold">
                  {profile.display_name}
                </h2>
                {isVerifiedProfile(profile) ? (
                  <BadgeCheck className="size-4 shrink-0" />
                ) : null}
              </div>
              <p className="text-sm text-[#766d62]">
                {followerCount ?? 0} followers - {followingCount ?? 0} following
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {(["followers", "following"] as const).map((item) => (
              <Link
                className={`flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-semibold ${
                  item === kind
                    ? "border-[#171412] bg-[#171412] text-white"
                    : "border-[#cfc8bd] bg-white text-[#171412]"
                }`}
                href={`/u/${profile.username}/${item}`}
                key={item}
              >
                {titleFor(item)}
              </Link>
            ))}
          </div>
        </section>

        {!canView ? (
          <section className="px-4 py-8">
            <div className="ttc-card rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-5 text-center">
              <LockKeyhole className="mx-auto mb-3 size-8 text-[#766d62]" />
              <h2 className="text-lg font-bold">Private community</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#766d62]">
                Sign in and follow this profile, if needed, to view their full
                community list.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
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
                  className="ttc-card flex items-center gap-3 rounded-md border border-[#cfc8bd] bg-white p-4"
                  href={`/u/${person.username}`}
                  key={person.id}
                >
                  <ProfileAvatar profile={person} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-bold">
                        {person.display_name}
                      </p>
                      {isVerifiedProfile(person) ? (
                        <BadgeCheck className="size-3.5 shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs text-[#766d62]">
                      @{person.username} - {person.account_type}
                    </p>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : (
          <section className="px-4 py-8">
            <div className="rounded-md border border-dashed border-[#cfc8bd] bg-[#fffdf9] p-5 text-center">
              {kind === "followers" ? (
                <Users className="mx-auto mb-3 size-8 text-[#766d62]" />
              ) : (
                <UserPlus className="mx-auto mb-3 size-8 text-[#766d62]" />
              )}
              <h2 className="text-lg font-bold">{emptyText(kind)}</h2>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white px-4 text-sm font-semibold"
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
