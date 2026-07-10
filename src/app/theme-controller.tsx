"use client";

import { useEffect } from "react";

export type ThemePreference = "light" | "dark" | "system";

export const themeStorageKey = "ttc-theme-preference";

export function resolveThemePreference(value: string | null): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;

  return "system";
}

export function applyThemePreference(preference: ThemePreference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
}

export function saveThemePreference(preference: ThemePreference) {
  window.localStorage.setItem(themeStorageKey, preference);
  applyThemePreference(preference);
}

export function ThemeController() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      applyThemePreference(
        resolveThemePreference(window.localStorage.getItem(themeStorageKey)),
      );
    };

    syncTheme();
    mediaQuery.addEventListener("change", syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      mediaQuery.removeEventListener("change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return null;
}
