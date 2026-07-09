export const languageOptions = [
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

export const countryOptions = [
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

export const languageCodes: ReadonlySet<string> = new Set(
  languageOptions.map(([value]) => value),
);
export const countryCodes: ReadonlySet<string> = new Set(
  countryOptions.map(([value]) => value),
);

export function languageLabel(value?: string | null) {
  return (
    languageOptions.find(([code]) => code === value)?.[1] ?? "English"
  );
}

export function normalizedLanguage(value?: string | null) {
  return value && languageCodes.has(value) ? value : "en";
}
