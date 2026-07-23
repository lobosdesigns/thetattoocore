export const publicBuildConfigError =
  "Public app configuration is unavailable.";

function isValidPublicUrl(value) {
  if (typeof value !== "string" || value.trim() !== value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function isValidPublishableKey(value) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)
  );
}

export function publicBuildEnvIsValid(env) {
  return (
    isValidPublicUrl(env.NEXT_PUBLIC_SUPABASE_URL) &&
    isValidPublishableKey(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}
