import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

type PublicProfile = {
  username: string;
  updated_at: string | null;
};

type PublicListing = {
  id: string;
  updated_at: string | null;
};

type PublicGig = {
  id: string;
  updated_at: string | null;
};

type PublicMerch = {
  id: string;
  updated_at: string | null;
};

type PublicPost = {
  id: string;
  updated_at: string | null;
};

type PublicThread = {
  id: string;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
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
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/support`,
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
    .is("banned_at", null)
    .is("suspended_at", null)
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<PublicProfile[]>();
  const { data: listings } = await supabase
    .from("marketplace_listings")
    .select("id, updated_at")
    .eq("status", "active")
    .eq("moderation_status", "active")
    .eq("visibility", "public_preview")
    .eq("is_sensitive", false)
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<PublicListing[]>();
  const { data: posts } = await supabase
    .from("feed_posts")
    .select("id, updated_at")
    .eq("is_published", true)
    .eq("moderation_status", "active")
    .eq("visibility", "public_preview")
    .eq("is_sensitive", false)
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<PublicPost[]>();
  const { data: threads } = await supabase
    .from("thread_posts")
    .select("id, updated_at")
    .eq("is_published", true)
    .eq("moderation_status", "active")
    .eq("visibility", "public_preview")
    .eq("is_sensitive", false)
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<PublicThread[]>();
  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, updated_at")
    .eq("status", "active")
    .eq("moderation_status", "active")
    .eq("visibility", "public_preview")
    .eq("is_sensitive", false)
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<PublicGig[]>();
  const { data: merch } = await supabase
    .from("merch_products")
    .select("id, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<PublicMerch[]>();

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
    ...(posts ?? []).map((post) => ({
      changeFrequency: "weekly" as const,
      lastModified: post.updated_at ? new Date(post.updated_at) : now,
      priority: 0.6,
      url: `${siteUrl}/p/${post.id}`,
    })),
    ...(threads ?? []).map((thread) => ({
      changeFrequency: "weekly" as const,
      lastModified: thread.updated_at ? new Date(thread.updated_at) : now,
      priority: 0.6,
      url: `${siteUrl}/t/${thread.id}`,
    })),
    ...(listings ?? []).map((listing) => ({
      changeFrequency: "weekly" as const,
      lastModified: listing.updated_at ? new Date(listing.updated_at) : now,
      priority: 0.6,
      url: `${siteUrl}/stuff/${listing.id}`,
    })),
    ...(gigs ?? []).map((gig) => ({
      changeFrequency: "weekly" as const,
      lastModified: gig.updated_at ? new Date(gig.updated_at) : now,
      priority: 0.6,
      url: `${siteUrl}/gigs/${gig.id}`,
    })),
    ...(merch ?? []).map((product) => ({
      changeFrequency: "weekly" as const,
      lastModified: product.updated_at ? new Date(product.updated_at) : now,
      priority: 0.6,
      url: `${siteUrl}/merch/${product.id}`,
    })),
  ];
}
