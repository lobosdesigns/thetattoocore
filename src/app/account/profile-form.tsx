"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useState } from "react";
import { updateProfile } from "./actions";
import { MediaInput } from "../media-input";
import { PendingSubmitButton } from "../pending-submit-button";
import { ThemePreferencePicker } from "../theme-preference-picker";
import { PwaInstallButton } from "../pwa-install-button";
import { countryOptions, languageLabel, languageOptions } from "@/lib/localization";

type Claims = {
  email?: string;
  sub: string;
};

type Profile = {
  account_type: "artist" | "enthusiast" | "studio" | "supplier" | "vendor";
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  city: string | null;
  country_code: string | null;
  display_name: string;
  facebook_url: string | null;
  instagram_url: string | null;
  is_adult_confirmed: boolean | null;
  is_private: boolean | null;
  comment_permission: "everyone" | "followers" | "none" | null;
  followers_visibility: "public" | "followers" | "private" | null;
  following_visibility: "public" | "followers" | "private" | null;
  location_personalization_enabled: boolean | null;
  notification_quiet_hours_enabled: boolean | null;
  notification_quiet_hours_end: string | null;
  notification_quiet_hours_start: string | null;
  notification_timezone: string | null;
  notify_email_important: boolean | null;
  notify_feed_activity: boolean | null;
  notify_follow_activity: boolean | null;
  notify_marketplace_gig_activity: boolean | null;
  notify_message_activity: boolean | null;
  notify_push_enabled: boolean | null;
  notify_thread_activity: boolean | null;
  preferred_language: string | null;
  region: string | null;
  shop_profile:
    | {
        display_name: string;
        username: string;
      }
    | null;
  shop_profile_id: string | null;
  theme_preference: "light" | "dark" | "system" | null;
  username: string;
  website_url: string | null;
  tiktok_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
};

const accountTypes = [
  ["enthusiast", "Enthusiast"],
  ["artist", "Artist"],
  ["studio", "Studio"],
  ["vendor", "Vendor"],
] as const;

const notificationOptions = [
  [
    "notify_follow_activity",
    "Follow activity",
    "New followers, follow requests, and approved follow requests.",
  ],
  [
    "notify_message_activity",
    "DMs",
    "Direct messages and ongoing conversation replies.",
  ],
  [
    "notify_feed_activity",
    "4U activity",
    "Likes and comments on your 4U posts.",
  ],
  [
    "notify_thread_activity",
    "Gossip activity",
    "Likes and comments on your Gossip posts.",
  ],
  [
    "notify_marketplace_gig_activity",
    "Stuff and Gigs",
    "DMs started from your Stuff listings or Gigs posts.",
  ],
] as const;

const notificationGroups = [
  {
    title: "Social",
    description: "Profile access and community requests.",
    options: [notificationOptions[0]],
  },
  {
    title: "Messages",
    description: "DMs and conversation activity.",
    options: [notificationOptions[1], notificationOptions[4]],
  },
  {
    title: "Post activity",
    description: "Likes and comments on your public work and gossip.",
    options: [notificationOptions[2], notificationOptions[3]],
  },
] as const;

const notificationSummary = [
  ["Live now", "In-app alerts and badges"],
  ["Next", "Email for important account events"],
  ["App alerts", "Available after opt-in"],
  ["Mobile", "Phone app alerts are off"],
] as const;

const followVisibilityOptions = [
  ["public", "Everyone", "Anyone can open the list."],
  ["followers", "Followers only", "Only accepted followers can open the list."],
  ["private", "Only me", "Only you can open the list."],
] as const;

const commentPermissionOptions = [
  ["everyone", "Everyone", "Signed-in members can comment."],
  ["followers", "Followers only", "Only accepted followers can comment."],
  ["none", "No one", "Only you can add comments."],
] as const;

const profileTabs = [
  ["profile", "Profile"],
  ["about", "About"],
  ["location", "Location"],
  ["appearance", "Appearance"],
  ["privacy", "Privacy"],
  ["notifications", "Notifications"],
] as const;

type ProfileTab = (typeof profileTabs)[number][0];

function profileTabFromHash(hash: string): ProfileTab {
  if (hash === "#profile-about-settings") return "about";
  if (hash === "#location-settings") return "location";
  if (hash === "#appearance-settings") return "appearance";
  if (hash === "#language-settings") return "location";
  if (hash === "#privacy-settings") return "privacy";
  if (hash === "#notification-settings") return "notifications";

  return "profile";
}

function profileHashForTab(tab: ProfileTab) {
  if (tab === "about") return "#profile-about-settings";
  if (tab === "location") return "#location-settings";
  if (tab === "appearance") return "#appearance-settings";
  if (tab === "privacy") return "#privacy-settings";
  if (tab === "notifications") return "#notification-settings";

  return "#profile-settings";
}

function profilePanelId(tab: ProfileTab) {
  return `profile-${tab}-panel`;
}

const alertSettingNotes = [
  "Current switches control in-app notifications and unread badges.",
  "The same choices can guide important email and installed-app alerts as those features open up.",
  "Quiet hours help reduce noisy alerts while keeping safety and account alerts available.",
  "Phone app alerts are off.",
] as const;

function RequiredMark() {
  return <span className="text-[color-mix(in_srgb,#d14b4b_82%,var(--foreground))]">*</span>;
}

function timeValue(value: string | null | undefined, fallback: string) {
  return value?.slice(0, 5) || fallback;
}

export function ProfileForm({
  claims,
  initialProfile,
}: {
  claims: Claims;
  initialProfile: Partial<Profile> | null;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const activateTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", profileHashForTab(tab));
  };
  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const lastIndex = profileTabs.length - 1;
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    const nextTab = profileTabs[nextIndex]?.[0];
    if (!nextTab) return;

    event.preventDefault();
    activateTab(nextTab);
    window.requestAnimationFrame(() => {
      document.getElementById(`${profilePanelId(nextTab)}-tab`)?.focus();
    });
  };
  const enabledNotificationCount = notificationOptions.filter(
    ([name]) => initialProfile?.[name] ?? true,
  ).length;
  const panelClass = (tab: ProfileTab) =>
    activeTab === tab ? "grid gap-4 sm:grid-cols-2" : "hidden";

  useEffect(() => {
    const syncTab = () => setActiveTab(profileTabFromHash(window.location.hash));

    syncTab();
    window.addEventListener("hashchange", syncTab);

    return () => window.removeEventListener("hashchange", syncTab);
  }, []);

  return (
    <form
      action={updateProfile}
      className="ttc-card scroll-mt-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] p-5 backdrop-blur"
      id="profile-settings"
    >
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Profile setup</h1>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">{claims.email}</p>
        <p className="ttc-surface mt-3 rounded-md border px-3 py-2 text-sm leading-5">
          Required fields are marked with <RequiredMark />. Artists and studios
          can post right away after saving, then submit license verification for
          the verified badge.
        </p>
      </div>

      <div
        aria-label="Profile setup sections"
        className="ttc-surface no-scrollbar mb-5 flex gap-2 overflow-x-auto rounded-md border p-2"
        role="tablist"
      >
        {profileTabs.map(([tab, label], index) => {
          const isActive = activeTab === tab;

          return (
            <button
              aria-controls={profilePanelId(tab)}
              aria-selected={isActive}
              className={`h-10 shrink-0 rounded-md border px-3 text-sm font-bold ${
                isActive
                  ? "ttc-control-active shadow-[0_8px_18px_rgba(23,20,18,0.16)]"
                  : "ttc-surface"
              }`}
              id={`${profilePanelId(tab)}-tab`}
              key={tab}
              onClick={() => {
                activateTab(tab);
              }}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`${profilePanelId("profile")}-tab`}
        className={panelClass("profile")}
        id={profilePanelId("profile")}
        role="tabpanel"
        tabIndex={0}
      >
        <div className="ttc-surface rounded-md border p-3 sm:col-span-2">
          <div
            className="relative overflow-hidden rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--foreground)_88%,var(--brand-gold))]"
            style={{ aspectRatio: "3 / 1" }}
          >
            {initialProfile?.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="size-full object-cover"
                src={initialProfile.banner_url}
              />
            ) : (
              <div className="flex size-full items-end bg-[linear-gradient(135deg,color-mix(in_srgb,var(--foreground)_92%,var(--brand-gold)),color-mix(in_srgb,var(--paper-warm)_76%,var(--brand-gold)))] p-4">
                <span className="rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_40%,transparent)] bg-black/45 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                  Profile banner
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold">Banner photo</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                Add a wide cover image for your profile. Shop fronts, flash
                sheets, healed work, or brand textures work well. No visible
                nudity.
              </p>
            </div>
            <div className="sm:min-w-80">
              <MediaInput
                accept="image/jpeg,image/png,image/webp"
                compact
                maxImageBytes={6 * 1024 * 1024}
                name="banner"
                videoAllowed={false}
              />
            </div>
          </div>
          {initialProfile?.banner_url ? (
            <label className="mt-3 flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
              <input className="mt-1 size-4" name="remove_banner" type="checkbox" />
              <span>
                <span className="block text-sm font-semibold">
                  Remove current banner
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
                  Use this if you want the profile to fall back to the default
                  TTC cover style. A newly uploaded banner replaces this choice.
                </span>
              </span>
            </label>
          ) : null}
        </div>

        <div className="ttc-surface rounded-md border p-3 sm:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--foreground)] text-xl font-bold text-[var(--brand-gold)]">
              {initialProfile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-full object-cover"
                  src={initialProfile.avatar_url}
                />
              ) : (
                (initialProfile?.display_name ?? "TC")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold">Profile photo</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                Upload a square logo, portrait, shop mark, or brand image. Images
                are optimized before upload. No visible nudity.
              </p>
              <div className="mt-3">
                <MediaInput
                  accept="image/jpeg,image/png,image/webp"
                  compact
                  maxImageBytes={4 * 1024 * 1024}
                  name="avatar"
                  videoAllowed={false}
                />
              </div>
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium">
            Username <RequiredMark />
          </span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.username ?? ""}
            maxLength={30}
            minLength={3}
            name="username"
            pattern="[a-zA-Z0-9_]{3,30}"
            placeholder="artistname"
            title="Use 3-30 letters, numbers, or underscores."
          />
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            3-30 letters, numbers, or underscores. This becomes your public URL.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Display name <RequiredMark />
          </span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.display_name ?? ""}
            minLength={2}
            name="display_name"
            placeholder="Artist Name"
          />
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            Shown on posts, listings, comments, and DMs.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Account type <RequiredMark />
          </span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.account_type ?? "enthusiast"}
            name="account_type"
          >
            {accountTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            Artists, studios, and vendors can apply for license verification.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Shop / studio profile</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.shop_profile?.username ?? ""}
            maxLength={30}
            name="shop_profile_username"
            pattern="@?[a-zA-Z0-9_]{3,30}"
            placeholder="@shopusername"
            title="Use a Studio account username."
          />
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            Artists can link the studio/shop profile they work from. The linked
            profile must be a Studio account.
          </span>
        </label>
      </div>

      <div
        aria-labelledby={`${profilePanelId("appearance")}-tab`}
        className={panelClass("appearance")}
        id={profilePanelId("appearance")}
        role="tabpanel"
        tabIndex={0}
      >
        <div
          className="sm:col-span-2"
          id="appearance-settings"
        >
          <h2 className="text-sm font-bold">Appearance</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
            Choose Light, Dark, or System mode. Signed-in members can save the
            preference with the rest of their profile settings.
          </p>
          <div className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
            <ThemePreferencePicker
              initialPreference={initialProfile?.theme_preference ?? "system"}
              name="theme_preference"
            />
          </div>
        </div>
      </div>

      <div
        aria-labelledby={`${profilePanelId("location")}-tab`}
        className={panelClass("location")}
        id={profilePanelId("location")}
        role="tabpanel"
        tabIndex={0}
      >
        <div
          className="sm:col-span-2"
          id="location-settings"
        >
          <span className="sr-only" id="language-settings" />
          <h2 className="text-sm font-bold">Location and language</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
            These settings power the page language signal, local discovery,
            and clearly labeled regional discovery. We use the location you type
            here, not precise browser GPS.
          </p>
          <div className="mt-3 grid gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-xs leading-5 text-[var(--muted)] sm:grid-cols-3">
            <p>
              <span className="block font-semibold">UI language</span>
              {languageLabel(initialProfile?.preferred_language ?? "en")}
            </p>
            <p>
              <span className="block font-semibold">Post translation</span>
              Original text is shown by default. Translated views should stay
              clearly labeled with the original available.
            </p>
            <p>
              <span className="block font-semibold">Discovery</span>
              Country and city help local Stuff, Gigs, and clearly labeled ads.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium">City</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.city ?? ""}
            name="city"
            placeholder="Austin"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Region</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.region ?? ""}
            name="region"
            placeholder="TX"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Country <RequiredMark />
          </span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.country_code ?? "US"}
            name="country_code"
          >
            {countryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Language <RequiredMark />
          </span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.preferred_language ?? "en"}
            name="preferred_language"
          >
            {languageOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        aria-labelledby={`${profilePanelId("about")}-tab`}
        className={panelClass("about")}
        id={profilePanelId("about")}
        role="tabpanel"
        tabIndex={0}
      >
        <div className="sm:col-span-2" id="profile-about-settings">
          <h2 className="text-sm font-bold">Bio and links</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
            Keep your public profile details here: a short bio plus official
            website and social links. This keeps account setup, location, and
            alerts from becoming one long scroll.
          </p>
          <div className="mt-3 grid gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-xs leading-5 text-[var(--muted)] sm:grid-cols-3">
            <p>
              <span className="block font-semibold">Bio</span>
              Style, shop notes, booking direction, and what clients should know.
            </p>
            <p>
              <span className="block font-semibold">Links</span>
              Public website and social profile links only.
            </p>
            <p>
              <span className="block font-semibold">Profile preview</span>
              These details appear on your profile and discovery surfaces.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Website</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.website_url ?? ""}
            name="website_url"
            placeholder="https://shop.com"
            type="url"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Instagram</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.instagram_url ?? ""}
            name="instagram_url"
            placeholder="https://instagram.com/artist"
            type="url"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">TikTok</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.tiktok_url ?? ""}
            name="tiktok_url"
            placeholder="https://tiktok.com/@artist"
            type="url"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Facebook</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.facebook_url ?? ""}
            name="facebook_url"
            placeholder="https://facebook.com/studio"
            type="url"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">YouTube</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.youtube_url ?? ""}
            name="youtube_url"
            placeholder="https://youtube.com/@artist"
            type="url"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">X / Twitter</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.x_url ?? ""}
            name="x_url"
            placeholder="https://x.com/artist"
            type="url"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.bio ?? ""}
            maxLength={500}
            name="bio"
            placeholder="Style, booking notes, shop, favorite work..."
          />
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            Optional, 500 characters max.
          </span>
        </label>
      </div>

      <div
        aria-labelledby={`${profilePanelId("privacy")}-tab`}
        className={panelClass("privacy")}
        id={profilePanelId("privacy")}
        role="tabpanel"
        tabIndex={0}
      >
        <div
          className="sm:col-span-2"
          id="privacy-settings"
        >
          <h2 className="text-sm font-bold">Privacy and safety</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
            Control profile visibility, local personalization, and adult access
            requirements.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 sm:col-span-2">
          <input
            className="mt-1 size-4"
            defaultChecked={
              initialProfile?.location_personalization_enabled ?? true
            }
            name="location_personalization_enabled"
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-medium">
              Use my location for discovery and local ads
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
              Uses your city, region, and country settings for Stuff,
              local discovery, and clearly labeled sponsored placements. Precise
              device location should be asked separately before it is ever used.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 sm:col-span-2">
          <input
            className="mt-1 size-4"
            defaultChecked={initialProfile?.is_private ?? false}
            name="is_private"
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-medium">
              Make my profile private
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
              Hides your profile from search engines and limits profile content
              to you and followers.
            </span>
          </span>
        </label>

        <label className="block rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
          <span className="text-sm font-medium">Who can see followers</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.followers_visibility ?? "public"}
            name="followers_visibility"
          >
            {followVisibilityOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            Choose who can open your follower list.
          </span>
        </label>

        <label className="block rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
          <span className="text-sm font-medium">Who can see following</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.following_visibility ?? "public"}
            name="following_visibility"
          >
            {followVisibilityOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            Choose who can open the profiles you follow.
          </span>
        </label>

        <label className="block rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 sm:col-span-2">
          <span className="text-sm font-medium">Who can comment</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={initialProfile?.comment_permission ?? "everyone"}
            name="comment_permission"
          >
            {commentPermissionOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
            Applies to new comments on your 4U and Gossip posts.
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,var(--card-rim))] bg-[color-mix(in_srgb,var(--brand-gold)_10%,var(--paper-warm))] p-3 sm:col-span-2">
          <input
            className="mt-1 size-4"
            defaultChecked={initialProfile?.is_adult_confirmed ?? false}
            name="is_adult_confirmed"
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-medium">
              I confirm I am 18 or older
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
              TheTattooCore is for adults. Tattoo, piercing, and body-art
              content may include sensitive non-nude healing, placement, scar,
              piercing, or body modification context. Visible nudity and
              pornographic content are not allowed. Review the{" "}
              <Link className="font-semibold underline" href="/terms">
                Terms and Content Policy
              </Link>
              .
            </span>
          </span>
        </label>
      </div>

      <section
        aria-labelledby={`${profilePanelId("notifications")}-tab`}
        className={`${activeTab === "notifications" ? "block" : "hidden"} scroll-mt-4`}
        id={profilePanelId("notifications")}
        role="tabpanel"
        tabIndex={0}
      >
        <span className="sr-only" id="notification-settings" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">Notification preferences</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
              Choose which in-app notifications create alerts and badges now.
              These same choices can guide important email and installed-app
              alerts when those channels are ready.
            </p>
          </div>
          <span className="w-fit rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
            {enabledNotificationCount}/{notificationOptions.length} on
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-4">
            {notificationSummary.map(([label, description]) => (
              <div
                className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] p-3"
                key={label}
              >
                <p className="text-xs font-semibold uppercase text-[var(--muted-strong)]">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold">{description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
            <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
              Alert settings
            </p>
            <ul className="mt-2 grid gap-2 text-xs leading-5 text-[var(--muted)]">
              {alertSettingNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Quiet hours</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                  Store a do-not-disturb window so important email and
                  installed-app alerts can respect it when those channels are
                  ready.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  className="size-4"
                  defaultChecked={
                    initialProfile?.notification_quiet_hours_enabled ?? false
                  }
                  name="notification_quiet_hours_enabled"
                  type="checkbox"
                />
                On
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--muted)]">
                  Start
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  defaultValue={timeValue(
                    initialProfile?.notification_quiet_hours_start,
                    "22:00",
                  )}
                  name="notification_quiet_hours_start"
                  type="time"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--muted)]">
                  End
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  defaultValue={timeValue(
                    initialProfile?.notification_quiet_hours_end,
                    "08:00",
                  )}
                  name="notification_quiet_hours_end"
                  type="time"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--muted)]">
                  Time zone
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  defaultValue={
                    initialProfile?.notification_timezone ?? "America/Chicago"
                  }
                  maxLength={80}
                  name="notification_timezone"
                  placeholder="America/Chicago"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
              <input
                className="mt-1 size-4"
                defaultChecked={initialProfile?.notify_email_important ?? true}
                name="notify_email_important"
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium">
                  Important email alerts
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
                  Account, verification, security, Stuff, and Gigs email can use
                  this preference when important email alerts are enabled.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
              <input
                className="mt-1 size-4"
                defaultChecked={initialProfile?.notify_push_enabled ?? false}
                name="notify_push_enabled"
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium">
                  Save device app alert preference
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
                  Saves your preference only. Device alerts stay off until
                  device setup and delivery settings are ready.
                </span>
              </span>
            </label>
          </div>
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
            <h3 className="text-sm font-semibold">Install app</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
              The automatic mobile install sheet stays hidden while browsing.
              Use this only when you decide you want the app on this device.
            </p>
            <div className="mt-3">
              <PwaInstallButton />
            </div>
          </div>
          {notificationGroups.map((group) => (
            <div
              className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3"
              key={group.title}
            >
              <div className="mb-3">
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                  {group.description}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.options.map(([name, label, description]) => (
                  <label className="flex items-start gap-3" key={name}>
                    <input
                      className="mt-1 size-4"
                      defaultChecked={initialProfile?.[name] ?? true}
                      name={name}
                      type="checkbox"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 flex items-center gap-3">
        <PendingSubmitButton
          className="h-11 rounded-md bg-[var(--foreground)] px-5 text-sm font-semibold text-[var(--background)]"
          pendingLabel="Saving"
          type="submit"
        >
          Save profile
        </PendingSubmitButton>
      </div>
    </form>
  );
}
