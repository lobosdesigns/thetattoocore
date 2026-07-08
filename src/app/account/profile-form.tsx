import { updateProfile } from "./actions";

type Claims = {
  email?: string;
  sub: string;
};

type Profile = {
  account_type: "artist" | "enthusiast" | "studio" | "supplier";
  bio: string | null;
  city: string | null;
  country_code: string | null;
  display_name: string;
  instagram_url: string | null;
  is_adult_confirmed: boolean | null;
  location_personalization_enabled: boolean | null;
  preferred_language: string | null;
  region: string | null;
  username: string;
  website_url: string | null;
};

const accountTypes = [
  ["enthusiast", "Enthusiast"],
  ["artist", "Artist"],
  ["studio", "Studio"],
  ["supplier", "Supplier"],
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

export function ProfileForm({
  claims,
  initialProfile,
}: {
  claims: Claims;
  initialProfile: Partial<Profile> | null;
}) {
  return (
    <form
      action={updateProfile}
      className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
    >
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Profile setup</h1>
        <p className="mt-1 text-sm text-[#766d62]">{claims.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Username</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.username ?? ""}
            name="username"
            placeholder="artistname"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Display name</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.display_name ?? ""}
            name="display_name"
            placeholder="Artist Name"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Account type</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.account_type ?? "enthusiast"}
            name="account_type"
          >
            {accountTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">City</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.city ?? ""}
            name="city"
            placeholder="Austin"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Region</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.region ?? ""}
            name="region"
            placeholder="TX"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Country</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
          <span className="text-sm font-medium">Language</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.website_url ?? ""}
            name="website_url"
            placeholder="https://shop.com"
            type="url"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Instagram</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.instagram_url ?? ""}
            name="instagram_url"
            placeholder="https://instagram.com/artist"
            type="url"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-3 text-sm outline-none focus:border-[#171412]"
            defaultValue={initialProfile?.bio ?? ""}
            maxLength={500}
            name="bio"
            placeholder="Style, booking notes, shop, favorite work..."
          />
        </label>

        <label className="flex items-start gap-3 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3 sm:col-span-2">
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
              Pornographic content is not allowed.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          className="h-11 rounded-md bg-[#171412] px-5 text-sm font-semibold text-white"
          type="submit"
        >
          Save profile
        </button>
      </div>
    </form>
  );
}
