"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendHostgatorEmail } from "@/lib/mail/hostgator";
import { countryCodes, languageCodes } from "@/lib/localization";
import {
  allowsInAppNotification,
  notificationPreferenceSelect,
  type NotificationPreferenceProfile,
} from "@/lib/notifications";
import { siteName, siteUrl, supportEmail } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanExternalUrl } from "@/lib/urls";

const LICENSE_BUCKET = "license-documents";
const AVATAR_BUCKET = "profile-avatars";
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const MAX_BANNER_BYTES = 6 * 1024 * 1024;
const LICENSE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_LICENSE_BYTES = 10 * 1024 * 1024;

type Claims = {
  email?: string;
  sub: string;
};

type MailSettings = {
  from_email: string | null;
  from_name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_secure: boolean;
  smtp_password_secret_name: string;
  reply_to_email: string | null;
  is_enabled: boolean;
};

const accountTypes = new Set(["artist", "enthusiast", "studio", "supplier", "vendor"]);
const adCampaignTypes = new Set(["artist_growth", "stuff_listing", "merch_listing"]);
const artistGrowthGoals = new Set(["leads", "messages", "engagement"]);
const stuffListingGoals = new Set([
  "listing_views",
  "seller_messages",
  "marketplace_engagement",
]);
const merchListingGoals = new Set(["product_views", "shop_visits", "purchases"]);
const adPlacements = new Set(["4u", "gossip", "stuff", "merch"]);
const themePreferences = new Set(["light", "dark", "system"]);

function accountPath(message: string, hash?: string) {
  const suffix = hash ? `#${hash}` : "";

  return `/account?message=${encodeURIComponent(message)}${suffix}`;
}

function safeInternalReturnPath(value: FormDataEntryValue | null) {
  const text = cleanText(value, 240);

  if (!text || !text.startsWith("/") || text.startsWith("//") || text.includes("\\"))
    return null;

  return text;
}

function bookingRedirectPath(formData: FormData, message: string) {
  const returnTo = safeInternalReturnPath(formData.get("return_to"));

  if (!returnTo) return bookingPath(message);

  const separator = returnTo.includes("?") ? "&" : "?";

  return `${returnTo}${separator}message=${encodeURIComponent(message)}`;
}

function verificationPath(message: string) {
  return accountPath(message, "verification-settings");
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanProfileUsername(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .slice(0, 30);
}

function isPastDate(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);

  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
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

function bookingDateTime(value: FormDataEntryValue | null) {
  const text = cleanText(value, 32);

  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return "invalid";

  const date = new Date(`${text}:00Z`);

  return Number.isFinite(date.getTime()) ? date.toISOString() : "invalid";
}

function centsFromDollars(value: FormDataEntryValue | null, maxCents: number) {
  const text = cleanText(value, 20);
  if (!text) return 0;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return -1;

  return Math.min(Math.round(amount * 100), maxCents);
}

function dollars(cents: number) {
  return Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
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

function isEmail(value?: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function maybeSendAccountDeletionEmail({
  email,
  reason,
  supabase,
  userId,
}: {
  email?: string;
  reason: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  if (!isEmail(email)) return;
  const recipientEmail = email;

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, notify_email_important, username")
      .eq("id", userId)
      .maybeSingle<{
        display_name: string | null;
        notify_email_important: boolean | null;
        username: string | null;
      }>(),
    supabase
      .from("mail_settings")
      .select(
        "from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
      )
      .maybeSingle<MailSettings>(),
  ]);

  if (profile?.notify_email_important === false || !settings?.is_enabled) {
    return;
  }

  const displayName = profile?.display_name || profile?.username || "there";
  const escapedDisplayName = escapeHtml(displayName);
  const escapedReason = reason ? escapeHtml(reason) : null;
  const accountUrl = `${siteUrl}/account#data-settings`;

  try {
    await sendHostgatorEmail({
      headers: {
        "X-TheTattooCore-Transactional": "account-deletion-request",
      },
      html: [
        `<h1>${siteName} account deletion request received</h1>`,
        `<p>Hi ${escapedDisplayName},</p>`,
        "<p>We received your account deletion request. During launch, deletion requests are reviewed manually so safety reports, marketplace issues, and legal obligations can be handled correctly.</p>",
        escapedReason ? `<p><strong>Your note:</strong> ${escapedReason}</p>` : "",
        `<p>You can check the request status from <a href="${accountUrl}">Account &gt; Data</a>.</p>`,
        `<p>For urgent help, email <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`,
      ].join(""),
      recipientEmail,
      settings,
      subject: `${siteName} account deletion request received`,
      text: [
        `${siteName} account deletion request received`,
        "",
        `Hi ${displayName},`,
        "",
        "We received your account deletion request. During launch, deletion requests are reviewed manually so safety reports, marketplace issues, and legal obligations can be handled correctly.",
        reason ? `Your note: ${reason}` : null,
        "",
        `Check status: ${accountUrl}`,
        `Urgent help: ${supportEmail}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch (error) {
    console.error("Account deletion confirmation email failed", error);
  }
}

async function maybeSendMerchFulfillmentEmail({
  buyerId,
  quantity,
  supabase,
  title,
  trackingCarrier,
  trackingNumber,
  trackingUrl,
}: {
  buyerId: string;
  quantity: number;
  supabase: Awaited<ReturnType<typeof createClient>>;
  title: string;
  trackingCarrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
}) {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, notify_email_important, username")
      .eq("id", buyerId)
      .maybeSingle<{
        display_name: string | null;
        notify_email_important: boolean | null;
        username: string | null;
      }>(),
    supabase
      .from("mail_settings")
      .select(
        "from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
      )
      .maybeSingle<MailSettings>(),
  ]);

  if (profile?.notify_email_important === false || !settings?.is_enabled) {
    return;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.warn("Merch fulfillment email skipped: missing service role key.");
    return;
  }

  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(buyerId);

  if (userError) {
    console.error("Merch fulfillment email user lookup failed", userError);
    return;
  }

  const recipientEmail = userData.user?.email;
  if (!isEmail(recipientEmail)) return;

  const displayName = profile?.display_name || profile?.username || "there";
  const accountUrl = `${siteUrl}/account#order-settings`;
  const subject = `${siteName} Merch order fulfilled`;
  const trackingText = trackingNumber
    ? `Tracking: ${[trackingCarrier, trackingNumber].filter(Boolean).join(" ")}`
    : null;

  try {
    await sendHostgatorEmail({
      headers: {
        "X-TheTattooCore-Transactional": "merch-fulfilled-buyer",
      },
      html: [
        `<h1>${escapeHtml(subject)}</h1>`,
        `<p>Hi ${escapeHtml(displayName)},</p>`,
        `<p>Your seller marked this Merch item fulfilled: ${escapeHtml(`${quantity} x ${title}`)}.</p>`,
        trackingText ? `<p>${escapeHtml(trackingText)}</p>` : "",
        trackingUrl
          ? `<p>Tracking link: <a href="${trackingUrl}">${trackingUrl}</a></p>`
          : "",
        `<p>You can review the latest order status from <a href="${accountUrl}">Account &gt; Orders</a>.</p>`,
        `<p>For help, email <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>`,
      ].join(""),
      recipientEmail,
      settings,
      subject,
      text: [
        subject,
        "",
        `Hi ${displayName},`,
        "",
        `Your seller marked this Merch item fulfilled: ${quantity} x ${title}.`,
        trackingText,
        trackingUrl ? `Tracking link: ${trackingUrl}` : null,
        "",
        `Review orders: ${accountUrl}`,
        `Help: ${supportEmail}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch (error) {
    console.error("Merch fulfillment email failed", error);
  }
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

async function uploadBanner({
  file,
  supabase,
  userId,
}: {
  file: File;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  if (!AVATAR_TYPES.has(file.type)) {
    redirect(accountPath("Use a JPG, PNG, or WebP banner photo."));
  }

  if (file.size > MAX_BANNER_BYTES) {
    redirect(accountPath("Banner photos can be up to 6 MB after optimization."));
  }

  const storagePath = `${userId}/banners/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    redirect(accountPath(error.message || "Could not upload banner photo."));
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
  const shopProfileUsername = cleanProfileUsername(
    formData.get("shop_profile_username"),
  );
  const countryCode = cleanText(formData.get("country_code"), 2).toUpperCase();
  const isAdultConfirmed = formData.get("is_adult_confirmed") === "on";
  const preferredLanguage = cleanText(formData.get("preferred_language"), 8);
  const themePreference = cleanText(formData.get("theme_preference"), 16);
  const avatar = fileFromForm(formData, "avatar");
  const banner = fileFromForm(formData, "banner");
  const removeBanner = formData.get("remove_banner") === "on";

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

  if (!themePreferences.has(themePreference)) {
    redirect(accountPath("Choose a valid appearance setting."));
  }

  if (!isAdultConfirmed) {
    redirect(accountPath("You must confirm you are 18 or older to use TheTattooCore."));
  }

  const avatarUrl = avatar
    ? await uploadAvatar({ file: avatar, supabase, userId: claims.sub })
    : null;
  const bannerUrl = banner
    ? await uploadBanner({ file: banner, supabase, userId: claims.sub })
    : null;
  let shopProfileId: string | null = null;

  if (accountType === "artist" && shopProfileUsername) {
    if (!/^[a-z0-9_]{3,30}$/.test(shopProfileUsername)) {
      redirect(accountPath("Shop profile username must be 3-30 letters, numbers, or underscores."));
    }

    if (shopProfileUsername === username) {
      redirect(accountPath("Choose a different shop profile than your own artist profile."));
    }

    const { data: shopProfile, error: shopProfileError } = await supabase
      .from("profiles")
      .select("id, account_type, username")
      .eq("username", shopProfileUsername)
      .maybeSingle<{
        account_type: string;
        id: string;
        username: string;
      }>();

    if (shopProfileError || !shopProfile) {
      redirect(accountPath(shopProfileError?.message || "Shop profile was not found."));
    }

    if (shopProfile.account_type !== "studio") {
      redirect(accountPath("Shop profile must be a Studio account."));
    }

    shopProfileId = shopProfile.id;
  }

  const profileUpdate = {
    account_type: accountType,
    adult_terms_accepted_at: new Date().toISOString(),
    bio: cleanText(formData.get("bio"), 500) || null,
    city: cleanText(formData.get("city"), 80) || null,
    country: countryCode,
    country_code: countryCode,
    display_name: displayName,
    facebook_url: cleanExternalUrl(formData.get("facebook_url"), 240),
    id: claims.sub,
    instagram_url: cleanExternalUrl(formData.get("instagram_url"), 240),
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
    shop_profile_id: accountType === "artist" ? shopProfileId : null,
    theme_preference: themePreference,
    tiktok_url: cleanExternalUrl(formData.get("tiktok_url"), 240),
    updated_at: new Date().toISOString(),
    username,
    website_url: cleanExternalUrl(formData.get("website_url"), 240),
    x_url: cleanExternalUrl(formData.get("x_url"), 240),
    youtube_url: cleanExternalUrl(formData.get("youtube_url"), 240),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    ...(bannerUrl ? { banner_url: bannerUrl } : removeBanner ? { banner_url: null } : {}),
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
    redirect(verificationPath("This account is banned from verification submissions."));
  }

  if (profile.suspended_at) {
    redirect(verificationPath("This account is suspended from verification submissions."));
  }

  if (!["artist", "studio", "vendor"].includes(profile.account_type)) {
    redirect(verificationPath("Artist, studio, or vendor account required for verification."));
  }

  const licenseName = cleanText(formData.get("license_name"), 160);
  const licenseNumber = cleanText(formData.get("license_number"), 120);
  const issuingRegion = cleanText(formData.get("issuing_region"), 120);
  const expiresOn = cleanText(formData.get("expires_on"), 20);
  const file = formData.get("license_document");

  if (licenseName.length < 2 || issuingRegion.length < 2) {
    redirect(verificationPath("License name and issuing region are required."));
  }

  if (isPastDate(expiresOn || null)) {
    redirect(verificationPath("Use a current, non-expired license document."));
  }

  const { data: pendingRequest, error: pendingError } = await supabase
    .from("license_verification_requests")
    .select("id")
    .eq("profile_id", claims.sub)
    .eq("status", "pending")
    .maybeSingle<{ id: string }>();

  if (pendingError) {
    redirect(
      verificationPath(pendingError.message || "Could not check verification status."),
    );
  }

  if (pendingRequest) {
    redirect(verificationPath("A verification request is already waiting for review."));
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect(verificationPath("Upload your license or certification document."));
  }

  if (!LICENSE_TYPES.has(file.type)) {
    redirect(verificationPath("Use a PDF, JPG, PNG, or WebP license file."));
  }

  if (file.size > MAX_LICENSE_BYTES) {
    redirect(verificationPath("License files can be up to 10 MB."));
  }

  const requestId = crypto.randomUUID();
  const storagePath = `${claims.sub}/${requestId}.${extensionFor(file)}`;
  const storageClient = createAdminClient() ?? supabase;
  const { error: uploadError } = await storageClient.storage
    .from(LICENSE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    redirect(verificationPath(uploadError.message || "Could not upload license file."));
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
    await storageClient.storage.from(LICENSE_BUCKET).remove([storagePath]);
    redirect(verificationPath(error.message || "Could not submit verification."));
  }

  revalidatePath("/account");
  redirect(verificationPath("License verification submitted for review."));
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

  if (campaignType === "merch_listing" && !merchListingGoals.has(goal)) {
    redirect(accountPath("Choose a valid Merch ad goal."));
  }

  const allowedPlacements =
    campaignType === "artist_growth"
      ? new Set(["4u", "gossip"])
      : campaignType === "stuff_listing"
        ? new Set(["stuff"])
        : new Set(["merch"]);
  const placements = selectedPlacements.filter((placement) =>
    allowedPlacements.has(placement),
  );

  if (!placements.length) {
    redirect(accountPath("Choose at least one valid ad placement."));
  }

  const name = cleanText(formData.get("name"), 120);
  const title = cleanText(formData.get("title"), 120);
  const body = cleanText(formData.get("body"), 300);
  const targetUrl = cleanExternalUrl(formData.get("target_url"), 240);
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
  revalidatePath("/admin/ads");
  redirect(accountPath("Ad campaign submitted for review."));
}

export async function markMerchSaleFulfilled(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const orderItemId = cleanText(formData.get("order_item_id"), 80);
  const trackingCarrier = cleanText(formData.get("tracking_carrier"), 80);
  const trackingNumber = cleanText(formData.get("tracking_number"), 120);
  const trackingUrl = cleanExternalUrl(formData.get("tracking_url"), 500);

  if (!orderItemId) {
    redirect(accountPath("Choose a valid Merch sale.", "order-settings"));
  }

  if (trackingUrl === null && cleanText(formData.get("tracking_url"), 500)) {
    redirect(accountPath("Use a valid http or https tracking link.", "order-settings"));
  }

  const { error } = await supabase.rpc("mark_own_merch_order_item_fulfilled", {
    p_order_item_id: orderItemId,
    p_tracking_carrier: trackingCarrier || null,
    p_tracking_number: trackingNumber || null,
    p_tracking_url: trackingUrl,
  });

  if (error) {
    redirect(
      accountPath(
        error.message || "Could not mark this Merch sale fulfilled.",
        "order-settings",
      ),
    );
  }

  const { data: fulfilledItem } = await supabase
    .from("merch_order_items")
    .select(
      "id, order_id, title_snapshot, quantity, merch_orders(id, buyer_id), merch_products(id)",
    )
    .eq("id", orderItemId)
    .maybeSingle<{
      id: string;
      merch_orders: { buyer_id: string; id: string } | null;
      merch_products: { id: string } | null;
      order_id: string;
      quantity: number;
      title_snapshot: string;
    }>();
  const buyerId = fulfilledItem?.merch_orders?.buyer_id;

  if (buyerId && buyerId !== claims.sub) {
    const { data: buyerPreferences } = await supabase
      .from("profiles")
      .select(notificationPreferenceSelect("marketplace_gig"))
      .eq("id", buyerId)
      .maybeSingle<NotificationPreferenceProfile>();

    if (allowsInAppNotification(buyerPreferences, "marketplace_gig")) {
      await supabase.from("notifications").insert({
        actor_id: claims.sub,
        body: trackingNumber
          ? `Tracking ${trackingCarrier ? `${trackingCarrier} ` : ""}${trackingNumber}`.slice(
              0,
              160,
            )
          : "Your seller marked this Merch order fulfilled.",
        href: "/account#order-settings",
        recipient_id: buyerId,
        subject_id: fulfilledItem.merch_products?.id ?? fulfilledItem.order_id,
        subject_type: fulfilledItem.merch_products?.id
          ? "merch_product"
          : "merch_order",
        title: `Merch fulfilled: ${fulfilledItem.quantity} x ${fulfilledItem.title_snapshot}`.slice(
          0,
          120,
        ),
        type: "merch_fulfilled",
      });
    }

    await maybeSendMerchFulfillmentEmail({
      buyerId,
      quantity: fulfilledItem.quantity,
      supabase,
      title: fulfilledItem.title_snapshot,
      trackingCarrier,
      trackingNumber,
      trackingUrl,
    });
  }

  revalidatePath("/account");
  revalidatePath("/admin/merch");
  revalidatePath("/notifications");
  redirect(accountPath("Merch sale marked fulfilled.", "order-settings"));
}

function bookingPath(message: string) {
  return accountPath(message, "booking-settings");
}

async function requireBookingManager() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login?return_to=%2Faccount%23booking-settings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, account_type, license_verified_at, suspended_at, banned_at")
    .eq("id", claims.sub)
    .maybeSingle<{
      account_type: string;
      banned_at: string | null;
      id: string;
      license_verified_at: string | null;
      suspended_at: string | null;
    }>();

  if (
    !profile ||
    !["artist", "studio"].includes(profile.account_type) ||
    !profile.license_verified_at ||
    profile.suspended_at ||
    profile.banned_at
  ) {
    redirect(bookingPath("Verified artist or studio status is required for booking tools."));
  }

  return { profile, supabase };
}

function cleanInteger(
  value: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(cleanText(value, 12), 10);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(min, Math.min(max, parsed));
}

export async function respondBookingRequest(formData: FormData) {
  const bookingId = cleanText(formData.get("booking_id"), 80);
  const decision = cleanText(formData.get("decision"), 20);
  const artistNote = cleanText(formData.get("artist_note"), 1000);
  const scheduledStartAt = bookingDateTime(formData.get("scheduled_start_at"));
  const scheduledEndAt = bookingDateTime(formData.get("scheduled_end_at"));
  const scheduledTimezone = cleanTimezone(formData.get("scheduled_timezone"));

  if (!bookingId || !["accept", "decline"].includes(decision)) {
    redirect(bookingPath("Choose a booking request and response."));
  }

  if (
    decision === "accept" &&
    (scheduledStartAt === "invalid" ||
      scheduledEndAt === "invalid" ||
      Boolean(scheduledStartAt) !== Boolean(scheduledEndAt))
  ) {
    redirect(bookingPath("Add both appointment start and end times, or leave both blank."));
  }

  if (decision === "accept" && scheduledStartAt && scheduledEndAt) {
    const startTime = new Date(scheduledStartAt).getTime();
    const endTime = new Date(scheduledEndAt).getTime();

    if (endTime <= startTime || endTime - startTime > 12 * 60 * 60 * 1000) {
      redirect(bookingPath("Appointment end time must be after the start and under 12 hours."));
    }
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login?return_to=%2Faccount%23booking-settings");
  }

  const { data: booking } = await supabase
    .from("booking_requests")
    .select(
      "id, artist_id, client_id, title, deposit_amount_cents, platform_fee_cents, status, payment_status",
    )
    .eq("id", bookingId)
    .maybeSingle<{
      artist_id: string;
      client_id: string;
      deposit_amount_cents: number;
      id: string;
      payment_status: string;
      platform_fee_cents: number;
      status: string;
      title: string;
    }>();

  if (!booking || booking.artist_id !== claims.sub) {
    redirect(bookingPath("That booking request is not available."));
  }

  if (booking.status !== "requested" || booking.payment_status !== "not_ready") {
    redirect(bookingPath("That booking request has already been handled."));
  }

  if (decision === "accept" && scheduledStartAt && scheduledEndAt) {
    const { data: blackoutConflict } = await supabase
      .from("booking_blackout_dates")
      .select("id")
      .eq("profile_id", claims.sub)
      .lt("starts_at", scheduledEndAt)
      .gt("ends_at", scheduledStartAt)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (blackoutConflict) {
      redirect(bookingPath("That appointment time overlaps a blackout window."));
    }

    const { data: bookingConflict } = await supabase
      .from("booking_requests")
      .select("id")
      .eq("artist_id", claims.sub)
      .neq("id", booking.id)
      .in("status", ["accepted", "deposit_pending", "deposit_paid", "completed"])
      .lt("scheduled_start_at", scheduledEndAt)
      .gt("scheduled_end_at", scheduledStartAt)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (bookingConflict) {
      redirect(bookingPath("That appointment time overlaps another scheduled booking."));
    }
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect(bookingPath("Booking responses need owner tools enabled first."));
  }

  const nextStatus = decision === "accept" ? "accepted" : "declined";
  const scheduledFields =
    decision === "accept" && scheduledStartAt && scheduledEndAt
      ? {
          scheduled_end_at: scheduledEndAt,
          scheduled_start_at: scheduledStartAt,
          scheduled_timezone: scheduledTimezone,
        }
      : {
          scheduled_end_at: null,
          scheduled_start_at: null,
          scheduled_timezone: null,
        };
  const now = new Date().toISOString();
  const { error } = await admin
    .from("booking_requests")
    .update({
      accepted_at: decision === "accept" ? now : null,
      artist_note: artistNote || null,
      declined_at: decision === "decline" ? now : null,
      ...scheduledFields,
      status: nextStatus,
    })
    .eq("id", booking.id)
    .eq("artist_id", claims.sub)
    .eq("status", "requested")
    .eq("payment_status", "not_ready");

  if (error) {
    redirect(bookingPath(error.message || "Could not update booking request."));
  }

  const { data: artist } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", claims.sub)
    .maybeSingle<{ display_name: string; username: string }>();
  const { data: clientPreferences } = await supabase
    .from("profiles")
    .select(notificationPreferenceSelect("message"))
    .eq("id", booking.client_id)
    .maybeSingle<NotificationPreferenceProfile>();

  if (allowsInAppNotification(clientPreferences, "message")) {
    await admin.from("notifications").insert({
      actor_id: claims.sub,
      body:
        decision === "accept"
          ? booking.deposit_amount_cents > 0
            ? `Accepted. Deposit checkout is the next step: ${dollars(booking.deposit_amount_cents)} plus TTC fee ${dollars(booking.platform_fee_cents)}.${scheduledStartAt ? " Appointment time was added." : ""}`
            : `Accepted.${scheduledStartAt ? " Appointment time was added." : " Deposit checkout can be added next if needed."}`
          : artistNote || "Declined for now.",
      href: `/u/${artist?.username ?? ""}#booking-request`,
      recipient_id: booking.client_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title:
        decision === "accept"
          ? `${artist?.display_name ?? "Artist"} accepted your booking request`
          : `${artist?.display_name ?? "Artist"} declined your booking request`,
      type: decision === "accept" ? "booking_accepted" : "booking_declined",
    });
  }

  revalidatePath("/account");
  revalidatePath("/notifications");
  redirect(
    bookingRedirectPath(
      formData,
      decision === "accept"
        ? "Booking accepted. Deposit checkout is the next booking step."
        : "Booking declined.",
    ),
  );
}

export async function cancelBookingRequest(formData: FormData) {
  const bookingId = cleanText(formData.get("booking_id"), 80);

  if (!bookingId) {
    redirect(bookingPath("Choose a booking request first."));
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login?return_to=%2Faccount%23booking-settings");
  }

  const { data: booking } = await supabase
    .from("booking_requests")
    .select("id, artist_id, client_id, title, status, payment_status")
    .eq("id", bookingId)
    .maybeSingle<{
      artist_id: string;
      client_id: string;
      id: string;
      payment_status: string;
      status: string;
      title: string;
    }>();

  if (!booking || booking.client_id !== claims.sub) {
    redirect(bookingPath("That booking request is not available."));
  }

  const canCancel =
    ["requested", "accepted"].includes(booking.status) &&
    ["not_ready", "payment_failed"].includes(booking.payment_status);

  if (!canCancel) {
    redirect(bookingPath("That booking cannot be cancelled from here."));
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect(bookingPath("Booking cancellation needs owner tools enabled first."));
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("booking_requests")
    .update({
      cancelled_at: now,
      status: "cancelled",
      updated_at: now,
    })
    .eq("id", booking.id)
    .eq("client_id", claims.sub)
    .in("status", ["requested", "accepted"])
    .in("payment_status", ["not_ready", "payment_failed"]);

  if (error) {
    redirect(bookingPath(error.message || "Could not cancel booking request."));
  }

  const [{ data: client }, { data: artistPreferences }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", claims.sub)
      .maybeSingle<{ display_name: string }>(),
    supabase
      .from("profiles")
      .select(notificationPreferenceSelect("message"))
      .eq("id", booking.artist_id)
      .maybeSingle<NotificationPreferenceProfile>(),
  ]);

  if (allowsInAppNotification(artistPreferences, "message")) {
    await admin.from("notifications").insert({
      actor_id: claims.sub,
      body: `${client?.display_name ?? "Client"} cancelled before deposit payment.`,
      href: "/account#booking-settings",
      recipient_id: booking.artist_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title: `Booking cancelled: ${booking.title}`.slice(0, 120),
      type: "booking_cancelled",
    });
  }

  revalidatePath("/account");
  revalidatePath("/messages");
  revalidatePath("/notifications");
  redirect(bookingRedirectPath(formData, "Booking request cancelled."));
}

export async function cancelAcceptedBookingAsArtist(formData: FormData) {
  const bookingId = cleanText(formData.get("booking_id"), 80);

  if (!bookingId) {
    redirect(bookingPath("Choose a booking request first."));
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login?return_to=%2Faccount%23booking-settings");
  }

  const { data: booking } = await supabase
    .from("booking_requests")
    .select("id, artist_id, client_id, title, status, payment_status")
    .eq("id", bookingId)
    .maybeSingle<{
      artist_id: string;
      client_id: string;
      id: string;
      payment_status: string;
      status: string;
      title: string;
    }>();

  if (!booking || booking.artist_id !== claims.sub) {
    redirect(bookingPath("That booking request is not available."));
  }

  const canCancel =
    booking.status === "accepted" &&
    ["not_ready", "payment_failed"].includes(booking.payment_status);

  if (!canCancel) {
    redirect(bookingPath("Only unpaid accepted bookings can be cancelled from here."));
  }

  const admin = createAdminClient();

  if (!admin) {
    redirect(bookingPath("Booking cancellation needs owner tools enabled first."));
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("booking_requests")
    .update({
      cancelled_at: now,
      status: "cancelled",
      updated_at: now,
    })
    .eq("id", booking.id)
    .eq("artist_id", claims.sub)
    .eq("status", "accepted")
    .in("payment_status", ["not_ready", "payment_failed"]);

  if (error) {
    redirect(bookingPath(error.message || "Could not cancel accepted booking."));
  }

  const [{ data: artist }, { data: clientPreferences }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", claims.sub)
      .maybeSingle<{ display_name: string; username: string }>(),
    supabase
      .from("profiles")
      .select(notificationPreferenceSelect("message"))
      .eq("id", booking.client_id)
      .maybeSingle<NotificationPreferenceProfile>(),
  ]);

  if (allowsInAppNotification(clientPreferences, "message")) {
    await admin.from("notifications").insert({
      actor_id: claims.sub,
      body: `${artist?.display_name ?? "Artist"} cancelled before deposit payment.`,
      href: `/u/${artist?.username ?? ""}#booking-request`,
      recipient_id: booking.client_id,
      subject_id: booking.id,
      subject_type: "booking_request",
      title: `Booking cancelled: ${booking.title}`.slice(0, 120),
      type: "booking_cancelled",
    });
  }

  revalidatePath("/account");
  revalidatePath("/messages");
  revalidatePath("/notifications");
  redirect(bookingRedirectPath(formData, "Accepted booking cancelled."));
}

export async function createBookingAppointmentType(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const name = cleanText(formData.get("appointment_name"), 80);
  const description = cleanText(formData.get("appointment_description"), 500);
  const durationMinutes = cleanInteger(formData.get("duration_minutes"), 60, 10, 720);
  const bufferBeforeMinutes = cleanInteger(
    formData.get("buffer_before_minutes"),
    0,
    0,
    240,
  );
  const bufferAfterMinutes = cleanInteger(
    formData.get("buffer_after_minutes"),
    0,
    0,
    240,
  );
  const depositPolicy = cleanText(formData.get("appointment_deposit_policy"), 20);
  const depositAmountCents = centsFromDollars(
    formData.get("appointment_deposit_amount"),
    500000,
  );

  if (name.length < 2) {
    redirect(bookingPath("Appointment types need a name."));
  }

  if (!["inherit", "none", "optional", "required"].includes(depositPolicy)) {
    redirect(bookingPath("Choose a valid appointment deposit policy."));
  }

  if (depositAmountCents < 0) {
    redirect(bookingPath("Appointment deposit must be a valid dollar amount."));
  }

  const { error } = await supabase.from("booking_appointment_types").insert({
    buffer_after_minutes: bufferAfterMinutes,
    buffer_before_minutes: bufferBeforeMinutes,
    deposit_amount_cents: depositAmountCents,
    deposit_policy: depositPolicy,
    description: description || null,
    duration_minutes: durationMinutes,
    name,
    profile_id: profile.id,
  });

  if (error) {
    redirect(bookingPath(error.message || "Could not add appointment type."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Appointment type added."));
}

export async function updateBookingAppointmentType(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const appointmentTypeId = cleanText(formData.get("appointment_type_id"), 80);
  const name = cleanText(formData.get("appointment_name"), 80);
  const description = cleanText(formData.get("appointment_description"), 500);
  const durationMinutes = cleanInteger(formData.get("duration_minutes"), 60, 10, 720);
  const bufferBeforeMinutes = cleanInteger(
    formData.get("buffer_before_minutes"),
    0,
    0,
    240,
  );
  const bufferAfterMinutes = cleanInteger(
    formData.get("buffer_after_minutes"),
    0,
    0,
    240,
  );
  const depositPolicy = cleanText(formData.get("appointment_deposit_policy"), 20);
  const depositAmountCents = centsFromDollars(
    formData.get("appointment_deposit_amount"),
    500000,
  );

  if (!appointmentTypeId) {
    redirect(bookingPath("Choose an appointment type first."));
  }

  if (name.length < 2) {
    redirect(bookingPath("Appointment types need a name."));
  }

  if (!["inherit", "none", "optional", "required"].includes(depositPolicy)) {
    redirect(bookingPath("Choose a valid appointment deposit policy."));
  }

  if (depositAmountCents < 0) {
    redirect(bookingPath("Appointment deposit must be a valid dollar amount."));
  }

  const { error } = await supabase
    .from("booking_appointment_types")
    .update({
      buffer_after_minutes: bufferAfterMinutes,
      buffer_before_minutes: bufferBeforeMinutes,
      deposit_amount_cents: depositAmountCents,
      deposit_policy: depositPolicy,
      description: description || null,
      duration_minutes: durationMinutes,
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentTypeId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(bookingPath(error.message || "Could not update appointment type."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Appointment type updated."));
}

export async function toggleBookingAppointmentType(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const appointmentTypeId = cleanText(formData.get("appointment_type_id"), 80);
  const isActive = formData.get("is_active") === "true";

  if (!appointmentTypeId) {
    redirect(bookingPath("Choose an appointment type first."));
  }

  const { error } = await supabase
    .from("booking_appointment_types")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentTypeId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(bookingPath(error.message || "Could not update appointment type."));
  }

  revalidatePath("/account");
  redirect(bookingPath(isActive ? "Appointment type restored." : "Appointment type paused."));
}

export async function deleteBookingAppointmentType(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const appointmentTypeId = cleanText(formData.get("appointment_type_id"), 80);

  if (!appointmentTypeId) {
    redirect(bookingPath("Choose an appointment type first."));
  }

  const { error } = await supabase
    .from("booking_appointment_types")
    .delete()
    .eq("id", appointmentTypeId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(bookingPath(error.message || "Could not delete appointment type."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Appointment type deleted."));
}

export async function createBookingSlot(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const appointmentTypeId = cleanText(formData.get("slot_appointment_type_id"), 80);
  const weekday = cleanInteger(formData.get("slot_weekday"), 1, 0, 6);
  const startsAt = cleanTime(formData.get("slot_starts_at"), "10:00");
  const endsAt = cleanTime(formData.get("slot_ends_at"), "17:00");
  const slotIntervalMinutes = cleanInteger(
    formData.get("slot_interval_minutes"),
    30,
    15,
    120,
  );
  const maxBookingsPerSlot = cleanInteger(formData.get("max_bookings_per_slot"), 1, 1, 20);
  const timezone = cleanTimezone(formData.get("slot_timezone"));

  if (startsAt >= endsAt) {
    redirect(bookingPath("Slot end time must be after the start time."));
  }

  if (![15, 20, 30, 45, 60, 90, 120].includes(slotIntervalMinutes)) {
    redirect(bookingPath("Choose a valid slot interval."));
  }

  const { error } = await supabase.from("booking_availability_slots").insert({
    appointment_type_id: appointmentTypeId || null,
    ends_at: endsAt,
    max_bookings_per_slot: maxBookingsPerSlot,
    profile_id: profile.id,
    slot_interval_minutes: slotIntervalMinutes,
    starts_at: startsAt,
    timezone,
    weekday,
  });

  if (error) {
    redirect(bookingPath(error.message || "Could not add booking slot."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Booking slot added."));
}

export async function updateBookingSlot(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const slotId = cleanText(formData.get("slot_id"), 80);
  const appointmentTypeId = cleanText(formData.get("slot_appointment_type_id"), 80);
  const weekday = cleanInteger(formData.get("slot_weekday"), 1, 0, 6);
  const startsAt = cleanTime(formData.get("slot_starts_at"), "10:00");
  const endsAt = cleanTime(formData.get("slot_ends_at"), "17:00");
  const slotIntervalMinutes = cleanInteger(
    formData.get("slot_interval_minutes"),
    30,
    15,
    120,
  );
  const maxBookingsPerSlot = cleanInteger(formData.get("max_bookings_per_slot"), 1, 1, 20);
  const timezone = cleanTimezone(formData.get("slot_timezone"));

  if (!slotId) {
    redirect(bookingPath("Choose a booking slot first."));
  }

  if (startsAt >= endsAt) {
    redirect(bookingPath("Slot end time must be after the start time."));
  }

  if (![15, 20, 30, 45, 60, 90, 120].includes(slotIntervalMinutes)) {
    redirect(bookingPath("Choose a valid slot interval."));
  }

  const { error } = await supabase
    .from("booking_availability_slots")
    .update({
      appointment_type_id: appointmentTypeId || null,
      ends_at: endsAt,
      max_bookings_per_slot: maxBookingsPerSlot,
      slot_interval_minutes: slotIntervalMinutes,
      starts_at: startsAt,
      timezone,
      updated_at: new Date().toISOString(),
      weekday,
    })
    .eq("id", slotId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(bookingPath(error.message || "Could not update booking slot."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Booking slot updated."));
}

export async function toggleBookingSlot(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const slotId = cleanText(formData.get("slot_id"), 80);
  const isActive = formData.get("is_active") === "true";

  if (!slotId) {
    redirect(bookingPath("Choose a booking slot first."));
  }

  const { error } = await supabase
    .from("booking_availability_slots")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", slotId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(bookingPath(error.message || "Could not update booking slot."));
  }

  revalidatePath("/account");
  redirect(bookingPath(isActive ? "Booking slot restored." : "Booking slot paused."));
}

export async function deleteBookingSlot(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const slotId = cleanText(formData.get("slot_id"), 80);

  if (!slotId) {
    redirect(bookingPath("Choose a booking slot first."));
  }

  const { error } = await supabase
    .from("booking_availability_slots")
    .delete()
    .eq("id", slotId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(bookingPath(error.message || "Could not remove booking slot."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Booking slot removed."));
}

export async function createBookingBlackoutDate(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const startsAt = bookingDateTime(formData.get("blackout_starts_at"));
  const endsAt = bookingDateTime(formData.get("blackout_ends_at"));
  const reason = cleanText(formData.get("blackout_reason"), 160);

  if (!startsAt || !endsAt || startsAt === "invalid" || endsAt === "invalid") {
    redirect(bookingPath("Add valid blackout start and end times."));
  }

  if (new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
    redirect(bookingPath("Blackout end time must be after the start time."));
  }

  const { error } = await supabase.from("booking_blackout_dates").insert({
    ends_at: endsAt,
    is_all_day: formData.get("blackout_all_day") === "on",
    profile_id: profile.id,
    reason: reason || null,
    starts_at: startsAt,
  });

  if (error) {
    redirect(bookingPath(error.message || "Could not add blackout window."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Blackout window added."));
}

export async function deleteBookingBlackoutDate(formData: FormData) {
  const { profile, supabase } = await requireBookingManager();
  const blackoutId = cleanText(formData.get("blackout_id"), 80);

  if (!blackoutId) {
    redirect(bookingPath("Choose a blackout window first."));
  }

  const { error } = await supabase
    .from("booking_blackout_dates")
    .delete()
    .eq("id", blackoutId)
    .eq("profile_id", profile.id);

  if (error) {
    redirect(bookingPath(error.message || "Could not remove blackout window."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Blackout window removed."));
}

export async function updateBookingSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login?return_to=%2Faccount%23booking-settings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, account_type, license_verified_at, suspended_at, banned_at")
    .eq("id", claims.sub)
    .maybeSingle<{
      account_type: string;
      banned_at: string | null;
      id: string;
      license_verified_at: string | null;
      suspended_at: string | null;
    }>();

  if (
    !profile ||
    !["artist", "studio"].includes(profile.account_type) ||
    !profile.license_verified_at ||
    profile.suspended_at ||
    profile.banned_at
  ) {
    redirect(bookingPath("Verified artist or studio status is required for booking availability."));
  }

  const bookingEnabled = formData.get("booking_enabled") === "on";
  const availabilitySummary = cleanText(formData.get("availability_summary"), 500);
  const bookingNote = cleanText(formData.get("booking_note"), 500);
  const bookingUrl = cleanExternalUrl(formData.get("booking_url"), 500);
  const calendarNotes = cleanText(formData.get("calendar_notes"), 500);
  const cancellationPolicy = cleanText(formData.get("cancellation_policy"), 500);
  const depositPolicy = cleanText(formData.get("deposit_policy"), 20);
  const defaultDepositAmountCents = centsFromDollars(
    formData.get("default_deposit_amount"),
    500000,
  );

  if (!["none", "optional", "required"].includes(depositPolicy)) {
    redirect(bookingPath("Choose a valid deposit policy."));
  }

  if (defaultDepositAmountCents < 0) {
    redirect(bookingPath("Default deposit must be a valid dollar amount."));
  }

  if (depositPolicy === "required" && defaultDepositAmountCents <= 0) {
    redirect(bookingPath("Required deposit settings need a default deposit amount."));
  }

  const { error } = await supabase.from("booking_settings").upsert({
    booking_enabled: bookingEnabled,
    booking_note: bookingNote || null,
    booking_url: bookingUrl,
    calendar_connection_status: "manual",
    calendar_notes: calendarNotes || null,
    cancellation_policy: cancellationPolicy || null,
    default_deposit_amount_cents: defaultDepositAmountCents,
    deposit_policy: depositPolicy,
    profile_id: claims.sub,
    timezone: cleanTimezone(formData.get("booking_timezone")),
    updated_at: new Date().toISOString(),
    weekly_availability: {
      summary: availabilitySummary || null,
    },
  });

  if (error) {
    redirect(bookingPath(error.message || "Could not save booking settings."));
  }

  revalidatePath("/account");
  redirect(bookingPath("Booking availability saved."));
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

  const reason = cleanText(formData.get("delete_reason"), 500) || null;
  const { error } = await supabase.from("account_deletion_requests").insert({
    profile_id: claims.sub,
    reason,
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

  await maybeSendAccountDeletionEmail({
    email: claims.email,
    reason,
    supabase,
    userId: claims.sub,
  });

  revalidatePath("/account");
  redirect(accountPath("Account deletion request submitted for review."));
}
