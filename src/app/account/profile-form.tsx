"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Claims = {
  sub: string;
  email?: string;
};

type Profile = {
  username: string;
  display_name: string;
  account_type: "artist" | "enthusiast" | "studio" | "supplier";
  bio: string;
  city: string;
  region: string;
  website_url: string;
  instagram_url: string;
};

const emptyProfile: Profile = {
  username: "",
  display_name: "",
  account_type: "enthusiast",
  bio: "",
  city: "",
  region: "",
  website_url: "",
  instagram_url: "",
};

export function ProfileForm({
  claims,
  initialProfile,
}: {
  claims: Claims;
  initialProfile: Partial<Profile> | null;
}) {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile>({
    ...emptyProfile,
    ...initialProfile,
  });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    setSaving(true);
    setStatus("");

    const username = profile.username.trim().toLowerCase();
    const displayName = profile.display_name.trim();

    if (!username || !displayName) {
      setStatus("Username and display name are required.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: claims.sub,
      username,
      display_name: displayName,
      account_type: profile.account_type,
      bio: profile.bio.trim() || null,
      city: profile.city.trim() || null,
      region: profile.region.trim() || null,
      website_url: profile.website_url.trim() || null,
      instagram_url: profile.instagram_url.trim() || null,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    setStatus(error ? error.message : "Profile saved.");
  }

  return (
    <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Profile setup</h1>
        <p className="mt-1 text-sm text-[#766d62]">{claims.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Username</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) => update("username", event.target.value)}
            placeholder="artistname"
            value={profile.username}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Display name</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) => update("display_name", event.target.value)}
            placeholder="Artist Name"
            value={profile.display_name}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Account type</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) =>
              update("account_type", event.target.value as Profile["account_type"])
            }
            value={profile.account_type}
          >
            <option value="enthusiast">Enthusiast</option>
            <option value="artist">Artist</option>
            <option value="studio">Studio</option>
            <option value="supplier">Supplier</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">City</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) => update("city", event.target.value)}
            placeholder="Austin"
            value={profile.city}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Region</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) => update("region", event.target.value)}
            placeholder="TX"
            value={profile.region}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Website</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) => update("website_url", event.target.value)}
            placeholder="https://shop.com"
            value={profile.website_url}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Instagram</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) => update("instagram_url", event.target.value)}
            placeholder="https://instagram.com/artist"
            value={profile.instagram_url}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-3 text-sm outline-none focus:border-[#171412]"
            onChange={(event) => update("bio", event.target.value)}
            placeholder="Style, booking notes, shop, favorite work..."
            value={profile.bio}
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          className="h-11 rounded-md bg-[#171412] px-5 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving}
          onClick={saveProfile}
          type="button"
        >
          {saving ? "Saving" : "Save profile"}
        </button>

        {status ? <p className="text-sm text-[#766d62]">{status}</p> : null}
      </div>
    </div>
  );
}
