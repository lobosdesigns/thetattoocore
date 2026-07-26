import type { createClient } from "@/lib/supabase/server";

export type PublicProfileSummary = {
  account_type: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  display_name: string;
  id: string;
  license_verified_at: string | null;
  username: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function loadPublicProfileMap(
  supabase: SupabaseServerClient,
  profileIds: Array<string | null | undefined>,
) {
  const ids = [...new Set(profileIds.filter((id): id is string => Boolean(id)))];

  if (!ids.length) return new Map<string, PublicProfileSummary>();

  const { data } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, avatar_url, banner_url, account_type, license_verified_at")
    .in("id", ids)
    .returns<PublicProfileSummary[]>();

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}
