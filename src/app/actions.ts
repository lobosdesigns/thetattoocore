"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MEDIA_BUCKET = "tattoo-media";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

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

function cleanWords(value: FormDataEntryValue | null, maxWords: number) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

function cleanId(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function mediaFromForm(formData: FormData, name: string) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName.slice(0, 12);
  }

  return file.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
}

function validateMedia(file: File) {
  const isVideo = file.type.startsWith("video/");
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (!MEDIA_TYPES.has(file.type)) {
    return "Use a JPG, PNG, WebP, GIF, MP4, MOV, or WebM file.";
  }

  if (file.size > maxBytes) {
    return isVideo
      ? "Videos can be up to 50 MB right now."
      : "Images can be up to 10 MB right now.";
  }

  return null;
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

async function uploadPostMedia({
  file,
  id,
  kind,
  supabase,
  userId,
}: {
  file: File;
  id: string;
  kind: "feed" | "marketplace" | "thread";
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const validationMessage = validateMedia(file);

  if (validationMessage) {
    redirect(homeMessage(validationMessage));
  }

  const path = `${userId}/${kind}/${id}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not upload media."));
  }

  return {
    bucket: MEDIA_BUCKET,
    mediaType: file.type.startsWith("video/") ? "video" : "image",
    path,
  };
}

export async function createFeedPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const caption = cleanWords(formData.get("caption"), 40);
  const locationLabel = cleanText(formData.get("location_label"), 80);
  const media = mediaFromForm(formData, "media");
  const styleTags = cleanText(formData.get("style_tags"), 160)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  if (caption.length < 3) {
    redirect(homeMessage("Feed post needs at least 3 characters."));
  }

  if (!media) {
    redirect(homeMessage("Feed posts need a photo or reel."));
  }

  const { data: post, error } = await supabase
    .from("feed_posts")
    .insert({
      author_id: userId,
      caption,
      kind: media?.type.startsWith("video/") ? "reel" : "photo",
      location_label: locationLabel || null,
      style_tags: styleTags,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(homeMessage(error.message || "Could not publish feed post."));
  }

  if (media && post) {
    const upload = await uploadPostMedia({
      file: media,
      id: post.id,
      kind: "feed",
      supabase,
      userId,
    });
    const { error: mediaError } = await supabase.from("feed_media").insert({
      media_type: upload.mediaType,
      post_id: post.id,
      storage_bucket: upload.bucket,
      storage_path: upload.path,
    });

    if (mediaError) {
      redirect(homeMessage(mediaError.message || "Media uploaded but could not attach to the post."));
    }
  }

  revalidatePath("/");
  redirect(homeMessage("Feed post published."));
}

export async function createThreadPost(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const body = cleanText(formData.get("body"), 8000);
  const media = mediaFromForm(formData, "media");

  if (body.length < 3) {
    redirect(homeMessage("Thread post needs at least 3 characters."));
  }

  if (media && !media.type.startsWith("image/")) {
    redirect(homeMessage("Thread posts support images right now."));
  }

  const { data: thread, error } = await supabase
    .from("thread_posts")
    .insert({
      author_id: userId,
      body,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(homeMessage(error.message || "Could not publish thread post."));
  }

  if (media && thread) {
    const upload = await uploadPostMedia({
      file: media,
      id: thread.id,
      kind: "thread",
      supabase,
      userId,
    });
    const { error: mediaError } = await supabase.from("thread_media").insert({
      media_type: "image",
      storage_bucket: upload.bucket,
      storage_path: upload.path,
      thread_id: thread.id,
    });

    if (mediaError) {
      redirect(homeMessage(mediaError.message || "Image uploaded but could not attach to the thread."));
    }
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
  const media = mediaFromForm(formData, "media");
  const region = cleanText(formData.get("region"), 40);
  const priceInput = cleanText(formData.get("price"), 20).replace(/[$,]/g, "");
  const priceNumber = priceInput ? Number(priceInput) : NaN;
  const priceCents = Number.isFinite(priceNumber)
    ? Math.max(0, Math.round(priceNumber * 100))
    : null;

  if (title.length < 3) {
    redirect(homeMessage("Listing title needs at least 3 characters."));
  }

  const { data: listing, error } = await supabase
    .from("marketplace_listings")
    .insert({
      seller_id: userId,
      title,
      description: description || null,
      category,
      city: city || null,
      region: region || null,
      price_cents: priceCents,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    redirect(homeMessage(error.message || "Could not publish listing."));
  }

  if (media && listing) {
    const upload = await uploadPostMedia({
      file: media,
      id: listing.id,
      kind: "marketplace",
      supabase,
      userId,
    });
    const { error: mediaError } = await supabase.from("marketplace_media").insert({
      listing_id: listing.id,
      storage_bucket: upload.bucket,
      storage_path: upload.path,
    });

    if (mediaError) {
      redirect(homeMessage(mediaError.message || "Media uploaded but could not attach to the listing."));
    }
  }

  revalidatePath("/");
  redirect(homeMessage("Marketplace listing published."));
}

export async function togglePostLike(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const postId = cleanId(formData.get("post_id"));
  const liked = cleanText(formData.get("liked"), 8) === "true";

  if (!postId) {
    redirect(homeMessage("Choose a post first."));
  }

  const result = liked
    ? await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId)
    : await supabase.from("post_likes").upsert({
        post_id: postId,
        user_id: userId,
      });

  if (result.error) {
    redirect(homeMessage(result.error.message || "Could not update like."));
  }

  revalidatePath("/");
  redirect("/#feed");
}

export async function createPostComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const body = cleanWords(formData.get("body"), 40);
  const postId = cleanId(formData.get("post_id"));

  if (!postId) {
    redirect(homeMessage("Choose a post first."));
  }

  if (!body) {
    redirect(homeMessage("Comment cannot be empty."));
  }

  const { error } = await supabase.from("post_comments").insert({
    author_id: userId,
    body,
    post_id: postId,
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not add comment."));
  }

  revalidatePath("/");
  redirect("/#feed");
}

export async function toggleThreadLike(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const threadId = cleanId(formData.get("thread_id"));
  const liked = cleanText(formData.get("liked"), 8) === "true";

  if (!threadId) {
    redirect(homeMessage("Choose a thread first."));
  }

  const result = liked
    ? await supabase
        .from("thread_likes")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", userId)
    : await supabase.from("thread_likes").upsert({
        thread_id: threadId,
        user_id: userId,
      });

  if (result.error) {
    redirect(homeMessage(result.error.message || "Could not update thread like."));
  }

  revalidatePath("/");
  redirect("/#threads");
}

export async function createThreadComment(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const body = cleanText(formData.get("body"), 2000);
  const threadId = cleanId(formData.get("thread_id"));

  if (!threadId) {
    redirect(homeMessage("Choose a thread first."));
  }

  if (!body) {
    redirect(homeMessage("Thread comment cannot be empty."));
  }

  const { error } = await supabase.from("thread_comments").insert({
    author_id: userId,
    body,
    thread_id: threadId,
  });

  if (error) {
    redirect(homeMessage(error.message || "Could not add thread comment."));
  }

  revalidatePath("/");
  redirect("/#threads");
}
