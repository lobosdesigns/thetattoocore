"use client";

import Link from "next/link";
import { Clock3, X } from "lucide-react";
import { useEffect, useMemo, useSyncExternalStore } from "react";

type RecentSearch = {
  category: string;
  city: string;
  href: string;
  label: string;
  q: string;
  region: string;
  type: string;
};

const storageKey = "ttc.recent-searches.v1";
const storageEventName = "ttc:recent-searches";
const maxRecentSearches = 8;
let cachedRaw = "";
let cachedSearches: RecentSearch[] = [];

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function searchLabel(search: Omit<RecentSearch, "href" | "label">) {
  const parts = [
    search.q,
    search.type && search.type !== "all" ? search.type : "",
    search.category,
    search.city,
    search.region,
  ].filter(Boolean);

  return parts.join(" / ") || "Search";
}

function hrefFor(search: Omit<RecentSearch, "href" | "label">) {
  const params = new URLSearchParams();

  if (search.q) params.set("q", search.q);
  if (search.type && search.type !== "all") params.set("type", search.type);
  if (search.category) params.set("category", search.category);
  if (search.city) params.set("city", search.city);
  if (search.region) params.set("region", search.region);

  const query = params.toString();

  return query ? `/search?${query}` : "/search";
}

function readRecentSearches() {
  const raw = localStorage.getItem(storageKey) ?? "[]";

  if (raw === cachedRaw) return cachedSearches;

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      cachedRaw = raw;
      cachedSearches = [];
      return cachedSearches;
    }

    cachedRaw = raw;
    cachedSearches = parsed
      .filter((item): item is RecentSearch => {
        return (
          item &&
          typeof item === "object" &&
          typeof item.href === "string" &&
          typeof item.label === "string"
        );
      })
      .slice(0, maxRecentSearches);

    return cachedSearches;
  } catch {
    cachedRaw = raw;
    cachedSearches = [];
    return cachedSearches;
  }
}

function getRecentSnapshot() {
  if (typeof window === "undefined") return [];

  return readRecentSearches();
}

function subscribeToRecentSearches(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(storageEventName, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEventName, callback);
  };
}

function emitRecentSearchUpdate() {
  window.dispatchEvent(new Event(storageEventName));
}

function writeRecentSearches(searches: RecentSearch[]) {
  localStorage.setItem(storageKey, JSON.stringify(searches.slice(0, maxRecentSearches)));
  emitRecentSearchUpdate();
}

export function RecentSearches({
  current,
}: {
  current: {
    category: string;
    city: string;
    q: string;
    region: string;
    type: string;
  };
}) {
  const normalizedCurrent = useMemo(
    () => ({
      category: clean(current.category),
      city: clean(current.city),
      q: clean(current.q),
      region: clean(current.region),
      type: clean(current.type || "all"),
    }),
    [current],
  );
  const recentSearches = useSyncExternalStore(
    subscribeToRecentSearches,
    getRecentSnapshot,
    () => [],
  );

  useEffect(() => {
    const stored = readRecentSearches();
    const hasCurrent = Boolean(
      normalizedCurrent.q ||
        normalizedCurrent.category ||
        normalizedCurrent.city ||
        normalizedCurrent.region,
    );

    if (!hasCurrent) return;

    const nextSearch = {
      ...normalizedCurrent,
      href: hrefFor(normalizedCurrent),
      label: searchLabel(normalizedCurrent),
    };
    const deduped = stored.filter((search) => search.href !== nextSearch.href);
    const next = [nextSearch, ...deduped].slice(0, maxRecentSearches);

    writeRecentSearches(next);
  }, [normalizedCurrent]);

  if (!recentSearches.length) return null;

  return (
    <section className="mt-4 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_82%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-strong)]">
          <Clock3 className="size-4 text-[var(--brand-gold)]" />
          Recent searches
        </div>
        <button
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--card-rim)] px-2 text-xs font-semibold text-[var(--muted-strong)]"
          onClick={() => {
            localStorage.removeItem(storageKey);
            emitRecentSearchUpdate();
          }}
          type="button"
        >
          <X className="size-3" />
          Clear
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recentSearches.map((search) => (
          <Link
            className="ttc-surface flex h-9 shrink-0 items-center rounded-md border px-3 text-xs font-semibold"
            href={search.href}
            key={search.href}
          >
            {search.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
