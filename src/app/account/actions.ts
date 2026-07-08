"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

const accountTypes = new Set(["artist", "enthusiast", "studio", "supplier"]);
const languages = new Set(["en", "es", "pt", "fr", "de", "it", "ja", "ko", "zh"]);
const countryCodes = new Set([
  "US",
  "CA",
  "MX",
  "BR",
  "GB",
  "FR",
  "DE",
  "IT",
  "ES",
  "JP",
  "KR",
  "AU",
]);

function accountPath(message: string) {
  return `/account?message=${encodeURIComponent(message)}`;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
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

  if (!languages.has(preferredLanguage)) {
    redirect(accountPath("Choose a valid language."));
  }

  if (!isAdultConfirmed) {
    redirect(accountPath("You must confirm you are 18 or older to use TheTattooCore."));
  }

  const { error } = await supabase.from("profiles").upsert({
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
    preferred_language: preferredLanguage,
    region: cleanText(formData.get("region"), 40) || null,
    updated_at: new Date().toISOString(),
    username,
    website_url: cleanUrl(formData.get("website_url")),
  });

  if (error) {
    redirect(accountPath(error.message || "Could not save profile."));
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath(`/u/${username}`);
  redirect(accountPath("Profile saved."));
}
