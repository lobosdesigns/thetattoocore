import { updateProfile } from "./actions";

type Claims = {
  email?: string;
  sub: string;
};

type Profile = {
  account_type: "artist" | "enthusiast" | "studio" | "supplier";
  bio: string | null;
  city: string | null;
  display_name: string;
  instagram_url: string | null;
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
