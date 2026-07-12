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
