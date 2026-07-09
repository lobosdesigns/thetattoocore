import Link from "next/link";
import { updateProfile } from "./actions";
import { PendingSubmitButton } from "../pending-submit-button";

type Claims = {
  email?: string;
  sub: string;
};

type Profile = {
  account_type: "artist" | "enthusiast" | "studio" | "supplier" | "vendor";
  bio: string | null;
  city: string | null;
  country_code: string | null;
  display_name: string;
  instagram_url: string | null;
  is_adult_confirmed: boolean | null;
  is_private: boolean | null;
  location_personalization_enabled: boolean | null;
  notify_feed_activity: boolean | null;
  notify_follow_activity: boolean | null;
  notify_marketplace_gig_activity: boolean | null;
  notify_message_activity: boolean | null;
  notify_thread_activity: boolean | null;
  preferred_language: string | null;
  region: string | null;
  username: string;
  website_url: string | null;
};

const accountTypes = [
  ["enthusiast", "Enthusiast"],
  ["artist", "Artist"],
  ["studio", "Studio"],
  ["vendor", "Vendor"],
] as const;

const languageOptions = [
  ["en", "English"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
] as const;

const countryOptions = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["MX", "Mexico"],
  ["BR", "Brazil"],
  ["GB", "United Kingdom"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["IT", "Italy"],
  ["ES", "Spain"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["AU", "Australia"],
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
  ["Social", "Follow requests"],
  ["DM", "Messages and replies"],
  ["Content", "4U and Gossip"],
  ["Commerce", "Stuff and Gigs"],
] as const;

function RequiredMark() {
  return <span className="text-[#a3432f]">*</span>;
}

export function ProfileForm({
  claims,
  initialProfile,
}: {
  claims: Claims;
  initialProfile: Partial<Profile> | null;
}) {
  const enabledNotificationCount = notificationOptions.filter(
    ([name]) => initialProfile?.[name] ?? true,
  ).length;

  return (
    <form
      action={updateProfile}
      className="ttc-card scroll-mt-4 rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-5"
      id="profile-settings"
    >
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Profile setup</h1>
        <p className="mt-1 text-sm text-[#766d62]">{claims.email}</p>
        <p className="mt-3 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 text-sm leading-5 text-[#4f473f]">
          Required fields are marked with <RequiredMark />. Artists and studios
          can post right away after saving, then submit license verification for
          the verified badge.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            required
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
            required
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

        <div
          className="border-t border-[#cfc8bd] pt-4 sm:col-span-2"
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
              local discovery, and future sponsored placements.
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
            required
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-medium">
              I confirm I am 18 or older
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#766d62]">
              TheTattooCore is for adults. Tattoo, piercing, and body-art
              content may include limited non-sexual nudity only when it shows
              the artwork, placement, healing, or body modification.
              Pornographic content is not allowed. Review the{" "}
              <Link className="font-semibold underline" href="/terms">
                Terms and Content Policy
              </Link>
              .
            </span>
          </span>
        </label>
      </div>

      <section
        className="mt-5 scroll-mt-4 border-t border-[#cfc8bd] pt-5"
        id="notification-settings"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">Notification preferences</h2>
            <p className="mt-1 text-xs leading-5 text-[#766d62]">
              Choose which in-app notifications create alerts and badges. Email
              delivery can follow these same choices later.
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
