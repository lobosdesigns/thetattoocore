"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { countryCodes, languageCodes } from "@/lib/localization";
import { createClient } from "@/lib/supabase/server";

const LICENSE_BUCKET = "license-documents";
const AVATAR_BUCKET = "profile-avatars";
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const LICENSE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_LICENSE_BYTES = 10 * 1024 * 1024;

type Claims = {
  sub: string;
};

const accountTypes = new Set(["artist", "enthusiast", "studio", "supplier", "vendor"]);
const adCampaignTypes = new Set(["artist_growth", "stuff_listing"]);
const artistGrowthGoals = new Set(["leads", "messages", "engagement"]);
const stuffListingGoals = new Set([
  "listing_views",
  "seller_messages",
  "marketplace_engagement",
]);
const adPlacements = new Set(["4u", "gossip", "stuff"]);

function accountPath(message: string) {
  return `/account?message=${encodeURIComponent(message)}`;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function isPastDate(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);

  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function cleanUrl(value: FormDataEntryValue | null) {
  const text = cleanText(value, 240);

  if (!text) return null;

  try {
    const url = new URL(text);

    if (!["http:", "https:"].includes(url.protocol)) return null;

    return url.toString();
  } catch {
    return null;
  }
}

function cleanTime(value: FormDataEntryValue | null, fallback: string) {
  const text = cleanText(value, 5);

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function cleanTimezone(value: FormDataEntryValue | null) {
  const text = cleanText(value, 80);

  if (!text || !/^[A-Za-z0-9_+\-/.]{2,80}$/.test(text)) {
    return "America/Chicago";
  }

  return text;
}

function centsFromDollars(value: FormDataEntryValue | null, maxCents: number) {
  const text = cleanText(value, 20);
  if (!text) return 0;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return -1;

  return Math.min(Math.round(amount * 100), maxCents);
}

function extensionFor(file: File) {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

function fileFromForm(formData: FormData, name: string) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

async function uploadAvatar({
  file,
  supabase,
  userId,
}: {
  file: File;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  if (!AVATAR_TYPES.has(file.type)) {
    redirect(accountPath("Use a JPG, PNG, or WebP profile photo."));
  }

  if (file.size > MAX_AVATAR_BYTES) {
    redirect(accountPath("Profile photos can be up to 4 MB after optimization."));
  }

  const storagePath = `${userId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    redirect(accountPath(error.message || "Could not upload profile photo."));
  }

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const username = cleanText(formData.get("username"), 30).toLowerCase();
  const displayName = cleanText(formData.get("display_name"), 80);
  const accountType = cleanText(formData.get("account_type"), 30);
  const countryCode = cleanText(formData.get("country_code"), 2).toUpperCase();
  const isAdultConfirmed = formData.get("is_adult_confirmed") === "on";
  const preferredLanguage = cleanText(formData.get("preferred_language"), 8);
  const avatar = fileFromForm(formData, "avatar");

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    redirect(accountPath("Username must be 3-30 letters, numbers, or underscores."));
  }

  if (displayName.length < 2) {
    redirect(accountPath("Display name needs at least 2 characters."));
  }

  if (!accountTypes.has(accountType)) {
    redirect(accountPath("Choose a valid account type."));
  }

  if (!countryCodes.has(countryCode)) {
    redirect(accountPath("Choose a valid country."));
  }

  if (!languageCodes.has(preferredLanguage)) {
    redirect(accountPath("Choose a valid language."));
  }

  if (!isAdultConfirmed) {
    redirect(accountPath("You must confirm you are 18 or older to use TheTattooCore."));
  }

  const avatarUrl = avatar
    ? await uploadAvatar({ file: avatar, supabase, userId: claims.sub })
    : null;
  const profileUpdate = {
    account_type: accountType,
    adult_terms_accepted_at: new Date().toISOString(),
    bio: cleanText(formData.get("bio"), 500) || null,
    city: cleanText(formData.get("city"), 80) || null,
    country: countryCode,
    country_code: countryCode,
    display_name: displayName,
    id: claims.sub,
    instagram_url: cleanUrl(formData.get("instagram_url")),
    is_adult_confirmed: true,
    is_private: formData.get("is_private") === "on",
    location_personalization_enabled:
      formData.get("location_personalization_enabled") === "on",
    notify_feed_activity: formData.get("notify_feed_activity") === "on",
    notify_follow_activity: formData.get("notify_follow_activity") === "on",
    notify_marketplace_gig_activity:
      formData.get("notify_marketplace_gig_activity") === "on",
    notify_message_activity: formData.get("notify_message_activity") === "on",
    notify_thread_activity: formData.get("notify_thread_activity") === "on",
    notification_quiet_hours_enabled:
      formData.get("notification_quiet_hours_enabled") === "on",
    notification_quiet_hours_end: cleanTime(
      formData.get("notification_quiet_hours_end"),
      "08:00",
    ),
    notification_quiet_hours_start: cleanTime(
      formData.get("notification_quiet_hours_start"),
      "22:00",
    ),
    notification_timezone: cleanTimezone(formData.get("notification_timezone")),
    notify_email_important: formData.get("notify_email_important") === "on",
    notify_push_enabled: formData.get("notify_push_enabled") === "on",
    preferred_language: preferredLanguage,
    region: cleanText(formData.get("region"), 40) || null,
    updated_at: new Date().toISOString(),
    username,
    website_url: cleanUrl(formData.get("website_url")),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  };

  const { error } = await supabase.from("profiles").upsert(profileUpdate);

  if (error) {
    redirect(accountPath(error.message || "Could not save profile."));
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath(`/u/${username}`);
  redirect(accountPath("Profile saved."));
}

export async function submitLicenseVerification(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, account_type, banned_at, suspended_at")
    .eq("id", claims.sub)
    .maybeSingle<{
      account_type: string;
      banned_at: string | null;
      id: string;
      suspended_at: string | null;
    }>();

  if (!profile) {
    redirect("/account");
  }

  if (profile.banned_at) {
    redirect(accountPath("This account is banned from verification submissions."));
  }

  if (profile.suspended_at) {
    redirect(accountPath("This account is suspended from verification submissions."));
  }

  if (!["artist", "studio", "vendor"].includes(profile.account_type)) {
    redirect(accountPath("Artist, studio, or vendor account required for verification."));
  }

  const licenseName = cleanText(formData.get("license_name"), 160);
  const licenseNumber = cleanText(formData.get("license_number"), 120);
  const issuingRegion = cleanText(formData.get("issuing_region"), 120);
  const expiresOn = cleanText(formData.get("expires_on"), 20);
  const file = formData.get("license_document");

  if (licenseName.length < 2 || issuingRegion.length < 2) {
    redirect(accountPath("License name and issuing region are required."));
  }

  if (isPastDate(expiresOn || null)) {
    redirect(accountPath("Use a current, non-expired license document."));
  }

  const { data: pendingRequest, error: pendingError } = await supabase
    .from("license_verification_requests")
    .select("id")
    .eq("profile_id", claims.sub)
    .eq("status", "pending")
    .maybeSingle<{ id: string }>();

  if (pendingError) {
    redirect(accountPath(pendingError.message || "Could not check verification status."));
  }

  if (pendingRequest) {
    redirect(accountPath("A verification request is already waiting for review."));
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect(accountPath("Upload your license or certification document."));
  }

  if (!LICENSE_TYPES.has(file.type)) {
    redirect(accountPath("Use a PDF, JPG, PNG, or WebP license file."));
  }

  if (file.size > MAX_LICENSE_BYTES) {
    redirect(accountPath("License files can be up to 10 MB."));
  }

  const requestId = crypto.randomUUID();
  const storagePath = `${claims.sub}/${requestId}.${extensionFor(file)}`;
  const { error: uploadError } = await supabase.storage
    .from(LICENSE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    redirect(accountPath(uploadError.message || "Could not upload license file."));
  }

  const { error } = await supabase.from("license_verification_requests").insert({
    account_type: profile.account_type,
    expires_on: expiresOn || null,
    issuing_region: issuingRegion,
    license_name: licenseName,
    license_number: licenseNumber || null,
    profile_id: claims.sub,
    storage_bucket: LICENSE_BUCKET,
    storage_path: storagePath,
  });

  if (error) {
    redirect(accountPath(error.message || "Could not submit verification."));
  }

  revalidatePath("/account");
  redirect(accountPath("License verification submitted for review."));
}

export async function submitAdCampaign(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, account_type, banned_at, suspended_at, license_verified_at")
    .eq("id", claims.sub)
    .maybeSingle<{
      account_type: string;
      banned_at: string | null;
      id: string;
      license_verified_at: string | null;
      suspended_at: string | null;
    }>();

  if (!profile) {
    redirect("/account");
  }

  if (profile.banned_at || profile.suspended_at) {
    redirect(accountPath("This account cannot submit ads right now."));
  }

  if (
    !["artist", "studio", "vendor"].includes(profile.account_type) ||
    !profile.license_verified_at
  ) {
    redirect(accountPath("Verified artist, studio, or vendor status is required for ads."));
  }

  const campaignType = cleanText(formData.get("campaign_type"), 40);
  const goal = cleanText(formData.get("goal"), 40);
  const selectedPlacements = formData
    .getAll("placements")
    .map((value) => cleanText(value, 20))
    .filter((value) => adPlacements.has(value));

  if (!adCampaignTypes.has(campaignType)) {
    redirect(accountPath("Choose a valid ad type."));
  }

  if (campaignType === "artist_growth" && !artistGrowthGoals.has(goal)) {
    redirect(accountPath("Choose a valid artist ad goal."));
  }

  if (campaignType === "stuff_listing" && !stuffListingGoals.has(goal)) {
    redirect(accountPath("Choose a valid Stuff ad goal."));
  }

  const allowedPlacements =
    campaignType === "artist_growth" ? new Set(["4u", "gossip"]) : new Set(["stuff"]);
  const placements = selectedPlacements.filter((placement) =>
    allowedPlacements.has(placement),
  );

  if (!placements.length) {
    redirect(accountPath("Choose at least one valid ad placement."));
  }

  const name = cleanText(formData.get("name"), 120);
  const title = cleanText(formData.get("title"), 120);
  const body = cleanText(formData.get("body"), 300);
  const targetUrl = cleanUrl(formData.get("target_url"));
  const bidCents = centsFromDollars(formData.get("bid_dollars"), 100000);
  const dailyBudgetCents = centsFromDollars(
    formData.get("daily_budget_dollars"),
    10000000,
  );
  const countryCode = cleanText(formData.get("country_code"), 2).toUpperCase();
  const language = cleanText(formData.get("language"), 8).toLowerCase();
  const keywords = cleanText(formData.get("keywords"), 240)
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);

  if (name.length < 3 || title.length < 3) {
    redirect(accountPath("Campaign name and headline need at least 3 characters."));
  }

  if (bidCents < 0 || dailyBudgetCents < 0) {
    redirect(accountPath("Ad bid and daily cap must be valid dollar amounts."));
  }

  if (targetUrl === null && cleanText(formData.get("target_url"), 240)) {
    redirect(accountPath("Use a valid http or https ad link."));
  }

  if (countryCode && !countryCodes.has(countryCode)) {
    redirect(accountPath("Choose a valid ad country."));
  }

  if (language && !languageCodes.has(language)) {
    redirect(accountPath("Choose a valid ad language."));
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .insert({
      advertiser_id: claims.sub,
      bid_cents: bidCents,
      body: body || null,
      campaign_type: campaignType,
      city: cleanText(formData.get("city"), 80) || null,
      country_code: countryCode || null,
      daily_budget_cents: dailyBudgetCents,
      goal,
      keywords,
      language: language || null,
      name,
      region: cleanText(formData.get("region"), 80) || null,
      status: "pending_review",
      target_url: targetUrl,
      title,
    })
    .select("id")
    .single<{ id: string }>();

  if (campaignError || !campaign) {
    redirect(accountPath(campaignError?.message || "Could not submit ad campaign."));
  }

  const { error: placementError } = await supabase
    .from("ad_campaign_placements")
    .insert(
      placements.map((placement) => ({
        campaign_id: campaign.id,
        placement,
      })),
    );

  if (placementError) {
    redirect(accountPath(placementError.message || "Ad saved, but placement failed."));
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  redirect(accountPath("Ad campaign submitted for review."));
}

export async function requestAccountDeletion(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const confirmation = cleanText(formData.get("delete_confirmation"), 20);

  if (confirmation !== "DELETE") {
    redirect(accountPath("Type DELETE to request account deletion."));
  }

  const { error } = await supabase.from("account_deletion_requests").insert({
    profile_id: claims.sub,
    reason: cleanText(formData.get("delete_reason"), 500) || null,
  });

  if (error) {
    redirect(
      accountPath(
        error.code === "23505"
          ? "You already have a pending account deletion request."
          : error.message || "Could not request account deletion.",
      ),
    );
  }

  revalidatePath("/account");
  redirect(accountPath("Account deletion request submitted for review."));
}
