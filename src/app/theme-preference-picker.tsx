"use client";

import { useState } from "react";
import {
  resolveThemePreference,
  saveThemePreference,
  themeStorageKey,
  type ThemePreference,
} from "./theme-controller";

const themeOptions = [
  ["system", "System", "Follow this device."],
  ["dark", "Dark", "Deeper app chrome."],
  ["light", "Light", "Brighter daytime view."],
] as const;

export function ThemePreferencePicker() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";

    return resolveThemePreference(window.localStorage.getItem(themeStorageKey));
  });

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {themeOptions.map(([value, label, description]) => (
        <button
          aria-pressed={preference === value}
          className={`rounded-md border p-3 text-left ${
            preference === value
              ? "border-[#c8953b] bg-[#171412] text-white shadow-[0_10px_24px_rgba(23,20,18,0.18)]"
              : "border-[#d8d1c6] bg-white text-[#4f473f]"
          }`}
          key={value}
          onClick={() => {
            setPreference(value);
            saveThemePreference(value);
          }}
          type="button"
        >
          <span className="block text-sm font-bold">{label}</span>
          <span
            className={`mt-1 block text-xs leading-5 ${
              preference === value ? "text-white/70" : "text-[#766d62]"
            }`}
          >
            {description}
          </span>
        </button>
      ))}
    </div>
  );
}
