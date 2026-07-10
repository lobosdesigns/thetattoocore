export const languageOptions = [
  ["en", "English"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["pl", "Polish"],
  ["sv", "Swedish"],
  ["tr", "Turkish"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
] as const;

export const countryOptions = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["MX", "Mexico"],
  ["AR", "Argentina"],
  ["BR", "Brazil"],
  ["CL", "Chile"],
  ["CO", "Colombia"],
  ["GB", "United Kingdom"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["PL", "Poland"],
  ["ES", "Spain"],
  ["SE", "Sweden"],
  ["TR", "Turkey"],
  ["ZA", "South Africa"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["SG", "Singapore"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
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

export function countryLabel(value?: string | null) {
  const normalized = value?.toUpperCase();

  return countryOptions.find(([code]) => code === normalized)?.[1] ?? normalized ?? "";
}

export function normalizedLanguage(value?: string | null) {
  return value && languageCodes.has(value) ? value : "en";
}
