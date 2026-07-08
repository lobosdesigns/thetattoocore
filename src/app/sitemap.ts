import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

type PublicProfile = {
  username: string;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    {
      changeFrequency: "daily",
      lastModified: now,
      priority: 1,
      url: siteUrl,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.4,
      url: `${siteUrl}/terms`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.4,
      url: `${siteUrl}/privacy`,
    },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return routes;
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
    },
  });
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, updated_at")
    .eq("is_private", false)
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<PublicProfile[]>();

  return [
    ...routes,
    ...(profiles ?? []).map((profile) => ({
      changeFrequency: "weekly" as const,
      lastModified: profile.updated_at
        ? new Date(profile.updated_at)
        : now,
      priority: 0.7,
      url: `${siteUrl}/u/${profile.username}`,
    })),
  ];
}
