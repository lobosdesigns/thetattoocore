import type { createClient } from "@/lib/supabase/server";

export type PublicProfileSummary = {
  account_type: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  city: string | null;
  display_name: string;
  id: string;
  license_verified_at: string | null;
  region: string | null;
  username: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
const publicProfileBatchSize = 100;

async function loadProfileMap(
  supabase: SupabaseServerClient,
  profileIds: Array<string | null | undefined>,
  profileTable: "profiles" | "public_profiles",
) {
  const ids = [...new Set(profileIds.filter((id): id is string => Boolean(id)))];

  if (!ids.length) return new Map<string, PublicProfileSummary>();

  const batches = Array.from(
    { length: Math.ceil(ids.length / publicProfileBatchSize) },
    (_, index) =>
      ids.slice(
        index * publicProfileBatchSize,
        (index + 1) * publicProfileBatchSize,
      ),
  );
  const profiles: PublicProfileSummary[] = [];
  for (const batch of batches) {
    const { data } = await supabase
      .from(profileTable)
      .select("id, username, display_name, avatar_url, banner_url, account_type, city, license_verified_at, region")
      .in("id", batch)
      .returns<PublicProfileSummary[]>();

    profiles.push(...(data ?? []));
  }

  return new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
}

export async function loadAuthenticatedProfileMap(
  supabase: SupabaseServerClient,
  profileIds: Array<string | null | undefined>,
) {
  return loadProfileMap(supabase, profileIds, "profiles");
}

export async function loadPublicProfileMap(
  supabase: SupabaseServerClient,
  profileIds: Array<string | null | undefined>,
) {
  return loadProfileMap(supabase, profileIds, "public_profiles");
}
