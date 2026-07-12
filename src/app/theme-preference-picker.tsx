"use client";

import { useEffect, useState } from "react";
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

export function ThemePreferencePicker({
  initialPreference = "system",
  name,
}: {
  initialPreference?: ThemePreference;
  name?: string;
}) {
  const [preference, setPreference] =
    useState<ThemePreference>(initialPreference);

  useEffect(() => {
    let syncFrame: number | null = window.requestAnimationFrame(() => {
      setPreference(
        resolveThemePreference(
          window.localStorage.getItem(themeStorageKey) ?? initialPreference,
        ),
      );
    });

    return () => {
      if (syncFrame != null) window.cancelAnimationFrame(syncFrame);
      syncFrame = null;
    };
  }, [initialPreference]);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {name ? <input name={name} type="hidden" value={preference} /> : null}
      {themeOptions.map(([value, label, description]) => (
        <button
          aria-pressed={preference === value}
          className={`rounded-md border p-3 text-left ${
            preference === value
              ? "ttc-control-active shadow-[0_10px_24px_rgba(23,20,18,0.18)]"
              : "ttc-surface"
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
              preference === value ? "opacity-75" : "ttc-muted"
            }`}
          >
            {description}
          </span>
        </button>
      ))}
    </div>
  );
}
