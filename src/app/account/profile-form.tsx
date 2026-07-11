"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  bio: string | null;
  city: string | null;
  country_code: string | null;
  display_name: string;
  instagram_url: string | null;
  is_adult_confirmed: boolean | null;
  is_private: boolean | null;
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
  theme_preference: "light" | "dark" | "system" | null;
  username: string;
  website_url: string | null;
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
    "Follow requests and approved follow requests.",
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
  ["PWA", "Browser push after install"],
  ["Apps", "Native iOS and Android push"],
] as const;

const profileTabs = [
  ["profile", "Profile"],
  ["appearance", "Appearance"],
  ["language", "Language"],
  ["privacy", "Privacy"],
  ["notifications", "Notifications"],
] as const;

type ProfileTab = (typeof profileTabs)[number][0];

function profileTabFromHash(hash: string): ProfileTab {
  if (hash === "#appearance-settings") return "appearance";
  if (hash === "#language-settings") return "language";
  if (hash === "#privacy-settings") return "privacy";
  if (hash === "#notification-settings") return "notifications";

  return "profile";
}

const pushRoadmap = [
  "Current switches control in-app notifications and unread badges.",
  "The same choices will feed email and web push when those channels are turned on.",
  "Quiet hours will suppress noisy future email/push while keeping safety and account alerts available.",
  "Native app push will use APNs for iPhone and FCM for Android after app-store builds.",
] as const;

function RequiredMark() {
  return <span className="text-[#a3432f]">*</span>;
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
        <p className="mt-1 text-sm text-[#766d62]">{claims.email}</p>
        <p className="ttc-surface mt-3 rounded-md border px-3 py-2 text-sm leading-5">
          Required fields are marked with <RequiredMark />. Artists and studios
          can post right away after saving, then submit license verification for
          the verified badge.
        </p>
      </div>

      <div className="ttc-surface no-scrollbar mb-5 flex gap-2 overflow-x-auto rounded-md border p-2">
        {profileTabs.map(([tab, label]) => (
          <button
            aria-pressed={activeTab === tab}
            className={`h-10 shrink-0 rounded-md border px-3 text-sm font-bold ${
              activeTab === tab
                ? "ttc-control-active shadow-[0_8px_18px_rgba(23,20,18,0.16)]"
                : "ttc-surface"
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className={panelClass("profile")}>
        <div className="ttc-surface rounded-md border p-3 sm:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#171412] text-xl font-bold text-[#c8953b]">
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
              <p className="mt-1 text-xs leading-5 text-[#766d62]">
                Upload a square logo, portrait, shop mark, or brand image. Images
                are optimized before upload. No visible nudity for launch.
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
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.username ?? ""}
            maxLength={30}
            minLength={3}
            name="username"
            pattern="[a-zA-Z0-9_]{3,30}"
            placeholder="artistname"
            title="Use 3-30 letters, numbers, or underscores."
          />
          <span className="mt-1 block text-xs leading-5 text-[#766d62]">
            3-30 letters, numbers, or underscores. This becomes your public URL.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Display name <RequiredMark />
          </span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.display_name ?? ""}
            minLength={2}
            name="display_name"
            placeholder="Artist Name"
          />
          <span className="mt-1 block text-xs leading-5 text-[#766d62]">
            Shown on posts, listings, comments, and DMs.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Account type <RequiredMark />
          </span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.account_type ?? "enthusiast"}
            name="account_type"
          >
            {accountTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs leading-5 text-[#766d62]">
            Artists, studios, and vendors can apply for license verification.
          </span>
        </label>
      </div>

      <div className={panelClass("appearance")}>
        <div
          className="sm:col-span-2"
          id="appearance-settings"
        >
          <h2 className="text-sm font-bold">Appearance</h2>
          <p className="mt-1 text-xs leading-5 text-[#766d62]">
            Choose Light, Dark, or System mode on this device. Account sync can
            come after the full color system moves from hardcoded colors to
            theme tokens.
          </p>
          <div className="mt-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
            <ThemePreferencePicker
              initialPreference={initialProfile?.theme_preference ?? "system"}
              name="theme_preference"
            />
          </div>
        </div>
      </div>

      <div className={panelClass("language")}>
        <div
          className="sm:col-span-2"
          id="language-settings"
        >
          <h2 className="text-sm font-bold">Language and region</h2>
          <p className="mt-1 text-xs leading-5 text-[#766d62]">
            These settings power the page language signal, local discovery,
            future translated UI, and simple ad targeting by country, region,
            city, and language. We use the location you type here, not precise
            browser GPS.
          </p>
          <div className="mt-3 grid gap-2 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3 text-xs leading-5 text-[#4f473f] sm:grid-cols-3">
            <p>
              <span className="block font-semibold">UI language</span>
              {languageLabel(initialProfile?.preferred_language ?? "en")}
            </p>
            <p>
              <span className="block font-semibold">Post translation</span>
              Original text now; manual language choice first, provider-backed
              translation later.
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
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.city ?? ""}
            name="city"
            placeholder="Austin"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Region</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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

        <label className="block">
          <span className="text-sm font-medium">Website</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.website_url ?? ""}
            name="website_url"
            placeholder="https://shop.com"
            type="url"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Instagram</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.instagram_url ?? ""}
            name="instagram_url"
            placeholder="https://instagram.com/artist"
            type="url"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-[#cfc8bd] bg-white px-3 py-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.bio ?? ""}
            maxLength={500}
            name="bio"
            placeholder="Style, booking notes, shop, favorite work..."
          />
          <span className="mt-1 block text-xs leading-5 text-[#766d62]">
            Optional, 500 characters max.
          </span>
        </label>
      </div>

      <div className={panelClass("privacy")}>
        <div
          className="sm:col-span-2"
          id="privacy-settings"
        >
          <h2 className="text-sm font-bold">Privacy and safety</h2>
          <p className="mt-1 text-xs leading-5 text-[#766d62]">
            Control profile visibility, local personalization, and adult access
            requirements.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3 sm:col-span-2">
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
            <span className="mt-1 block text-xs leading-5 text-[#766d62]">
              Uses your city, region, and country settings for marketplace,
              local discovery, and future sponsored placements. Precise device
              location should be asked separately before it is ever used.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3 sm:col-span-2">
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
            <span className="mt-1 block text-xs leading-5 text-[#766d62]">
              Hides your profile from search engines and limits profile content
              to you and followers.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fff7ec] p-3 sm:col-span-2">
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
            <span className="mt-1 block text-xs leading-5 text-[#766d62]">
              TheTattooCore is for adults. Tattoo, piercing, and body-art
              content may include sensitive non-nude healing, placement, scar,
              piercing, or body modification context. Visible nudity and
              pornographic content are not allowed for launch. Review the{" "}
              <Link className="font-semibold underline" href="/terms">
                Terms and Content Policy
              </Link>
              .
            </span>
          </span>
        </label>
      </div>

      <section
        className={`${activeTab === "notifications" ? "block" : "hidden"} scroll-mt-4`}
        id="notification-settings"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">Notification preferences</h2>
            <p className="mt-1 text-xs leading-5 text-[#766d62]">
              Choose which in-app notifications create alerts and badges now.
              These same choices will become the base for email, PWA push, and
              native app push later.
            </p>
          </div>
          <span className="w-fit rounded-md border border-[#d8d1c6] bg-white px-2 py-1 text-xs font-semibold text-[#4f473f]">
            {enabledNotificationCount}/{notificationOptions.length} on
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-4">
            {notificationSummary.map(([label, description]) => (
              <div
                className="rounded-md border border-[#d8d1c6] bg-white p-3"
                key={label}
              >
                <p className="text-xs font-semibold uppercase text-[#766d62]">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold">{description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
            <p className="text-xs font-bold uppercase text-[#766d62]">
              Push roadmap
            </p>
            <ul className="mt-2 grid gap-2 text-xs leading-5 text-[#4f473f]">
              {pushRoadmap.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Quiet hours</h3>
                <p className="mt-1 text-xs leading-5 text-[#766d62]">
                  Store a do-not-disturb window now so email, PWA push, and
                  native app push can respect it later.
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
                <span className="text-xs font-semibold text-[#4f473f]">
                  Start
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                  defaultValue={timeValue(
                    initialProfile?.notification_quiet_hours_start,
                    "22:00",
                  )}
                  name="notification_quiet_hours_start"
                  type="time"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#4f473f]">
                  End
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                  defaultValue={timeValue(
                    initialProfile?.notification_quiet_hours_end,
                    "08:00",
                  )}
                  name="notification_quiet_hours_end"
                  type="time"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#4f473f]">
                  Time zone
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
            <label className="flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
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
                <span className="mt-1 block text-xs leading-5 text-[#766d62]">
                  Account, verification, security, Stuff, and Gigs email can
                  use this when transactional email is expanded.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
              <input
                className="mt-1 size-4"
                defaultChecked={initialProfile?.notify_push_enabled ?? false}
                name="notify_push_enabled"
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium">
                  Prepare push notifications
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#766d62]">
                  Saves your preference only. Browser and native push still
                  need install/device-token setup later.
                </span>
              </span>
            </label>
          </div>
          <div className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
            <h3 className="text-sm font-semibold">Install app</h3>
            <p className="mt-1 text-xs leading-5 text-[#766d62]">
              The automatic mobile install sheet stays hidden while browsing.
              Use this only when you decide you want the app on this device.
            </p>
            <div className="mt-3">
              <PwaInstallButton />
            </div>
          </div>
          {notificationGroups.map((group) => (
            <div
              className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3"
              key={group.title}
            >
              <div className="mb-3">
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#766d62]">
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
                      <span className="mt-1 block text-xs leading-5 text-[#766d62]">
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
          className="h-11 rounded-md bg-[#171412] px-5 text-sm font-semibold text-white"
          pendingLabel="Saving"
          type="submit"
        >
          Save profile
        </PendingSubmitButton>
      </div>
    </form>
  );
}
