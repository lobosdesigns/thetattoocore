import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MEDIA_BUCKET = "tattoo-media";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SENSITIVE_REASONS = new Set([
  "body_art_nudity",
  "healing",
  "scar_cover",
  "piercing",
  "other",
]);
const VISIBILITY_VALUES = new Set(["public_preview", "members", "private"]);

function redirectHome(request: Request, message: string) {
  return NextResponse.redirect(
    new URL(`/?message=${encodeURIComponent(message)}#gigs`, request.url),
    { status: 303 },
  );
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanVisibility(value: FormDataEntryValue | null) {
  const text = cleanText(value, 32);

  return VISIBILITY_VALUES.has(text) ? text : "public_preview";
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName.slice(0, 12);
  }

  return file.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
}

function mediaFromForm(formData: FormData) {
  const value = formData.get("media");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle<{ id: string }>();

  if (!profile) {
    return NextResponse.redirect(new URL("/account", request.url), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const title = cleanText(formData.get("title"), 140);
  const description = cleanText(formData.get("description"), 3000);
  const category = cleanText(formData.get("category"), 40) || "job";
  const city = cleanText(formData.get("city"), 80);
  const region = cleanText(formData.get("region"), 40);
  const country = cleanText(formData.get("country"), 2).toUpperCase() || "US";
  const startsAt = cleanText(formData.get("starts_at"), 40);
  const endsAt = cleanText(formData.get("ends_at"), 40);
  const compensation = cleanText(formData.get("compensation"), 120);
  const contactUrl = cleanText(formData.get("contact_url"), 300);
  const visibility = cleanVisibility(formData.get("visibility"));
  const isSensitive = formData.get("is_sensitive") === "on";
  const sensitiveReason = cleanText(formData.get("sensitive_reason"), 40);
  const media = mediaFromForm(formData);
  const safeSensitiveReason = isSensitive
    ? SENSITIVE_REASONS.has(sensitiveReason)
      ? sensitiveReason
      : "body_art_nudity"
    : null;

  if (title.length < 3) {
    return redirectHome(request, "Gig title needs at least 3 characters.");
  }

  if (media && (!IMAGE_TYPES.has(media.type) || media.size > MAX_IMAGE_BYTES)) {
    return redirectHome(request, "Use a JPG, PNG, WebP, or GIF up to 10 MB.");
  }

  const { data: gig, error } = await supabase
    .from("gigs")
    .insert({
      category,
      city: city || null,
      compensation: compensation || null,
      contact_url: contactUrl || null,
      country,
      description: description || null,
      ends_at: endsAt || null,
      is_indexable: visibility === "public_preview" && !isSensitive,
      is_sensitive: isSensitive,
      moderation_status: "active",
      poster_id: userId,
      region: region || null,
      sensitive_reason: safeSensitiveReason,
      starts_at: startsAt || null,
      status: "active",
      title,
      visibility,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !gig) {
    return redirectHome(request, error?.message || "Could not publish gig.");
  }

  if (media) {
    const storagePath = `${userId}/gig/${gig.id}/${crypto.randomUUID()}.${extensionFor(media)}`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, media, {
        cacheControl: "31536000",
        contentType: media.type,
        upsert: false,
      });

    if (uploadError) {
      return redirectHome(request, uploadError.message || "Gig created, but image upload failed.");
    }

    const { error: mediaError } = await supabase.from("gig_media").insert({
      gig_id: gig.id,
      is_sensitive: isSensitive,
      media_type: "image",
      sensitive_reason: safeSensitiveReason,
      storage_bucket: MEDIA_BUCKET,
      storage_path: storagePath,
    });

    if (mediaError) {
      return redirectHome(request, mediaError.message || "Gig created, but image could not attach.");
    }
  }

  revalidatePath("/");

  return redirectHome(request, "Gig posted.");
}
