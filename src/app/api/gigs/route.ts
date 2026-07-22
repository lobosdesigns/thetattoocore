import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { inspectMediaFile, validateMediaMetadata } from "@/lib/media/metadata";
import {
  allowsInAppNotification,
  notificationPreferenceSelect,
  type NotificationPreferenceProfile,
} from "@/lib/notifications";
import { insertNotifications } from "@/lib/notification-write";
import { createClient } from "@/lib/supabase/server";
import {
  resolveEligibleTaggedProfiles,
  type TagContentVisibility,
} from "@/lib/tag-audience";
import { cleanExternalUrl } from "@/lib/urls";

const MEDIA_BUCKET = "tattoo-media";
const VISIBILITY_VALUES = new Set<TagContentVisibility>([
  "public_preview",
  "members",
  "private",
]);
const MAX_TAGGED_MEMBERS = 10;

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

  return VISIBILITY_VALUES.has(text as TagContentVisibility)
    ? (text as TagContentVisibility)
    : "public_preview";
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

function cleanTaggedUsernames(value: FormDataEntryValue | null) {
  const matches = cleanText(value, 500).match(/[a-z0-9_\.]{2,30}/gi) ?? [];
  const seen = new Set<string>();

  return matches
    .map((match) => match.replace(/^@/, "").toLowerCase())
    .filter((username) => {
      if (seen.has(username)) return false;
      seen.add(username);

      return true;
    })
    .slice(0, MAX_TAGGED_MEMBERS);
}

async function currentDisplayName({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle<{ display_name: string | null; username: string | null }>();

  return data?.display_name || data?.username || "A member";
}

async function blockRelationshipExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetId: string,
) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`,
    )
    .limit(1)
    .maybeSingle<{ blocker_id: string }>();

  return Boolean(data);
}

async function notifyGigTag({
  actorId,
  actorName,
  gigId,
  ownerId,
  supabase,
}: {
  actorId: string;
  actorName: string;
  gigId: string;
  ownerId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  if (ownerId === actorId) return;
  if (await blockRelationshipExists(supabase, actorId, ownerId)) return;

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select(notificationPreferenceSelect("marketplace_gig"))
    .eq("id", ownerId)
    .maybeSingle<NotificationPreferenceProfile>();

  if (!allowsInAppNotification(ownerProfile, "marketplace_gig")) return;

  await insertNotifications({
    actor_id: actorId,
    body: `${actorName} tagged you in a Gig.`,
    href: `/gigs/${gigId}`,
    recipient_id: ownerId,
    subject_id: gigId,
    subject_type: "gig",
    title: "Tagged in a Gig",
    type: "gig_tag",
  });
}

async function syncGigTags({
  gigId,
  isSensitive,
  supabase,
  taggedUsernames,
  userId,
  visibility,
}: {
  gigId: string;
  isSensitive: boolean;
  supabase: Awaited<ReturnType<typeof createClient>>;
  taggedUsernames: string[];
  userId: string;
  visibility: TagContentVisibility;
}) {
  if (!taggedUsernames.length) return null;

  const eligibility = await resolveEligibleTaggedProfiles({
    actorId: userId,
    contentOwnerId: userId,
    isActive: true,
    isSensitive,
    taggedUsernames,
    visibility,
  });

  if (eligibility.error) {
    console.error("Gig tag eligibility check failed.", eligibility.error);
    return "Could not check tagged members. Please try again.";
  }

  const rows = eligibility.profiles.map((profile) => ({
    gig_id: gigId,
    tagged_by: userId,
    tagged_profile_id: profile.id,
  }));

  if (!rows.length) return null;

  const { error: insertError } = await supabase.from("gig_tags").insert(rows);

  if (insertError) {
    console.error("Gig tag insert failed.", insertError);
    return "Could not add tagged members. Please try again.";
  }

  const actorName = await currentDisplayName({ supabase, userId });

  await Promise.all(
    rows.map((row) =>
      notifyGigTag({
        actorId: userId,
        actorName,
        gigId,
        ownerId: row.tagged_profile_id,
        supabase,
      }),
    ),
  );

  return null;
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
  const contactUrl = cleanExternalUrl(formData.get("contact_url"), 300);
  const taggedUsernames = cleanTaggedUsernames(formData.get("tagged_usernames"));
  const visibility = cleanVisibility(formData.get("visibility"));
  const isSensitive = false;
  const media = mediaFromForm(formData);
  const metadata = media ? await inspectMediaFile(media) : null;
  const safeSensitiveReason = null;

  if (title.length < 3) {
    return redirectHome(request, "Gig title needs at least 3 characters.");
  }

  if (metadata) {
    const validationMessage = validateMediaMetadata(metadata);

    if (validationMessage || metadata.mediaType !== "image") {
      return redirectHome(
        request,
        validationMessage || "Gigs support images right now.",
      );
    }
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
    console.error("Gig publish failed.", error);
    return redirectHome(request, "Could not publish gig. Please try again.");
  }

  if (media) {
    const storagePath = `${userId}/gig/${gig.id}/${crypto.randomUUID()}.${extensionFor(media)}`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, media, {
        cacheControl: "31536000",
        contentType: metadata?.mimeType ?? media.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Gig image upload failed.", uploadError);
      return redirectHome(request, "Gig was created, but the image could not upload.");
    }

    const { error: mediaError } = await supabase.from("gig_media").insert({
      duration_seconds: metadata?.durationSeconds ?? null,
      file_size_bytes: metadata?.fileSizeBytes ?? media.size,
      gig_id: gig.id,
      height: metadata?.height ?? null,
      is_sensitive: isSensitive,
      media_type: "image",
      mime_type: metadata?.mimeType ?? media.type,
      original_filename: metadata?.originalFilename ?? media.name.slice(0, 180),
      sensitive_reason: safeSensitiveReason,
      storage_bucket: MEDIA_BUCKET,
      storage_path: storagePath,
      width: metadata?.width ?? null,
    });

    if (mediaError) {
      console.error("Gig image attach failed.", mediaError);
      return redirectHome(request, "Gig was created, but the image could not attach.");
    }
  }

  const tagError = await syncGigTags({
    gigId: gig.id,
    isSensitive,
    supabase,
    taggedUsernames,
    userId,
    visibility,
  });

  if (tagError) {
    return redirectHome(request, tagError);
  }

  revalidatePath("/");

  return redirectHome(request, "Gig posted.");
}
