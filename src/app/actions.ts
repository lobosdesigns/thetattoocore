"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

function homeMessage(message: string) {
  return `/?message=${encodeURIComponent(message)}`;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

async function requireProfile() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", claims.sub)
    .maybeSingle<{ id: string }>();

  if (!profile) {
    redirect("/account");
  }

  return { supabase, userId: claims.sub };
}

export async function createFeedPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const caption = cleanText(formData.get("caption"), 2200);
  const locationLabel = cleanText(formData.get("location_label"), 80);
  const styleTags = cleanText(formData.get("style_tags"), 160)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  if (caption.length < 3) {
    redirect(homeMessage("Feed post needs at least 3 characters."));
  }

  const { error } = await supabase.from("feed_posts").insert({
    author_id: userId,
    caption,
    location_label: locationLabel || null,
    style_tags: styleTags,
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not publish feed post."));
  }

  revalidatePath("/");
  redirect(homeMessage("Feed post published."));
}

export async function createThreadPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const body = cleanText(formData.get("body"), 1000);

  if (body.length < 3) {
    redirect(homeMessage("Thread post needs at least 3 characters."));
  }

  const { error } = await supabase.from("thread_posts").insert({
    author_id: userId,
    body,
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not publish thread post."));
  }

  revalidatePath("/");
  redirect(homeMessage("Thread posted."));
}

export async function createMarketplaceListing(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const title = cleanText(formData.get("title"), 120);
  const description = cleanText(formData.get("description"), 2000);
  const category = cleanText(formData.get("category"), 40) || "flash";
  const city = cleanText(formData.get("city"), 80);
  const region = cleanText(formData.get("region"), 40);
  const priceInput = cleanText(formData.get("price"), 20).replace(/[$,]/g, "");
  const priceNumber = priceInput ? Number(priceInput) : NaN;
  const priceCents = Number.isFinite(priceNumber)
    ? Math.max(0, Math.round(priceNumber * 100))
    : null;

  if (title.length < 3) {
    redirect(homeMessage("Listing title needs at least 3 characters."));
  }

  const { error } = await supabase.from("marketplace_listings").insert({
    seller_id: userId,
    title,
    description: description || null,
    category,
    city: city || null,
    region: region || null,
    price_cents: priceCents,
    status: "active",
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not publish listing."));
  }

  revalidatePath("/");
  redirect(homeMessage("Marketplace listing published."));
}
