import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type TagContentVisibility =
  | "public_preview"
  | "members"
  | "followers"
  | "verified_artists_shops"
  | "verified_professionals"
  | "private";

export type EligibleTaggedProfile = {
  id: string;
  username: string;
};

type TagCandidateProfile = EligibleTaggedProfile & {
  account_type: string;
  adult_terms_accepted_at: string | null;
  is_adult_confirmed: boolean;
  license_verified_at: string | null;
};

function profileMatchesAudience({
  acceptedFollowerIds,
  blockedProfileIds,
  contentOwnerId,
  isSensitive,
  profile,
  visibility,
}: {
  acceptedFollowerIds: Set<string>;
  blockedProfileIds: Set<string>;
  contentOwnerId: string;
  isSensitive: boolean;
  profile: TagCandidateProfile;
  visibility: TagContentVisibility;
}) {
  if (blockedProfileIds.has(profile.id)) return false;
  if (profile.id === contentOwnerId) return true;

  if (
    isSensitive &&
    (!profile.is_adult_confirmed || !profile.adult_terms_accepted_at)
  ) {
    return false;
  }

  if (visibility === "public_preview" || visibility === "members") return true;
  if (visibility === "followers") return acceptedFollowerIds.has(profile.id);
  if (visibility === "private") return false;

  if (visibility === "verified_artists_shops") {
    return Boolean(
      profile.license_verified_at &&
        ["artist", "studio"].includes(profile.account_type),
    );
  }

  if (visibility === "verified_professionals") {
    return Boolean(
      profile.license_verified_at &&
        ["artist", "vendor"].includes(profile.account_type),
    );
  }

  return false;
}

export async function resolveEligibleTaggedProfiles({
  actorId,
  contentOwnerId,
  isActive,
  isSensitive,
  taggedUsernames,
  visibility,
}: {
  actorId: string;
  contentOwnerId: string;
  isActive: boolean;
  isSensitive: boolean;
  taggedUsernames: string[];
  visibility: TagContentVisibility;
}): Promise<{
  error: unknown | null;
  profiles: EligibleTaggedProfile[];
}> {
  if (!taggedUsernames.length || !isActive) {
    return { error: null, profiles: [] };
  }

  const admin = createAdminClient();

  if (!admin) {
    return {
      error: new Error("Tag audience lookup is unavailable."),
      profiles: [],
    };
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, username, account_type, license_verified_at, is_adult_confirmed, adult_terms_accepted_at",
    )
    .in("username", taggedUsernames)
    .is("banned_at", null)
    .is("suspended_at", null)
    .returns<TagCandidateProfile[]>();

  if (profileError) {
    return { error: profileError, profiles: [] };
  }

  const candidates = (profiles ?? []).filter(
    (profile) => profile.id !== actorId,
  );

  if (!candidates.length) {
    return { error: null, profiles: [] };
  }

  const candidateIds = candidates.map((profile) => profile.id);
  const relatedProfileIds = Array.from(
    new Set([actorId, contentOwnerId]),
  );
  const followerLookup =
    visibility === "followers"
      ? admin
          .from("follows")
          .select("follower_id")
          .in("follower_id", candidateIds)
          .eq("following_id", contentOwnerId)
          .eq("status", "accepted")
      : Promise.resolve({ data: [], error: null });

  const [followerResult, candidatesBlockingResult, partiesBlockingResult] =
    await Promise.all([
      followerLookup,
      admin
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .in("blocker_id", candidateIds)
        .in("blocked_id", relatedProfileIds),
      admin
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .in("blocker_id", relatedProfileIds)
        .in("blocked_id", candidateIds),
    ]);

  const relationshipError =
    followerResult.error ||
    candidatesBlockingResult.error ||
    partiesBlockingResult.error;

  if (relationshipError) {
    return { error: relationshipError, profiles: [] };
  }

  const acceptedFollowerIds = new Set(
    (followerResult.data ?? []).map((row) => row.follower_id),
  );
  const candidateIdSet = new Set(candidateIds);
  const blockedProfileIds = new Set<string>();

  for (const relationship of [
    ...(candidatesBlockingResult.data ?? []),
    ...(partiesBlockingResult.data ?? []),
  ]) {
    if (candidateIdSet.has(relationship.blocker_id)) {
      blockedProfileIds.add(relationship.blocker_id);
    }
    if (candidateIdSet.has(relationship.blocked_id)) {
      blockedProfileIds.add(relationship.blocked_id);
    }
  }

  return {
    error: null,
    profiles: candidates.filter((profile) =>
      profileMatchesAudience({
        acceptedFollowerIds,
        blockedProfileIds,
        contentOwnerId,
        isSensitive,
        profile,
        visibility,
      }),
    ),
  };
}
