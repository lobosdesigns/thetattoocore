"use client";

import Link from "next/link";
import { Bookmark, Clock3, X } from "lucide-react";
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
const savedStorageKey = "ttc.saved-searches.v1";
const storageEventName = "ttc:recent-searches";
const savedStorageEventName = "ttc:saved-searches";
const maxRecentSearches = 8;
const maxSavedSearches = 12;
let cachedRaw = "";
let cachedSearches: RecentSearch[] = [];
let cachedSavedRaw = "";
let cachedSavedSearches: RecentSearch[] = [];

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

function readStoredSearches({
  cache,
  key,
  limit,
}: {
  cache: {
    raw: string;
    searches: RecentSearch[];
  };
  key: string;
  limit: number;
}) {
  const raw = localStorage.getItem(key) ?? "[]";

  if (raw === cache.raw) return cache.searches;

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      cache.raw = raw;
      cache.searches = [];
      return cache.searches;
    }

    cache.raw = raw;
    cache.searches = parsed
      .filter((item): item is RecentSearch => {
        return (
          item &&
          typeof item === "object" &&
          typeof item.href === "string" &&
          typeof item.label === "string"
        );
      })
      .slice(0, limit);

    return cache.searches;
  } catch {
    cache.raw = raw;
    cache.searches = [];
    return cache.searches;
  }
}

function recentCache() {
  return {
    get raw() {
      return cachedRaw;
    },
    set raw(value: string) {
      cachedRaw = value;
    },
    get searches() {
      return cachedSearches;
    },
    set searches(value: RecentSearch[]) {
      cachedSearches = value;
    },
  };
}

function savedCache() {
  return {
    get raw() {
      return cachedSavedRaw;
    },
    set raw(value: string) {
      cachedSavedRaw = value;
    },
    get searches() {
      return cachedSavedSearches;
    },
    set searches(value: RecentSearch[]) {
      cachedSavedSearches = value;
    },
  };
}

function readRecentSearches() {
  return readStoredSearches({
    cache: recentCache(),
    key: storageKey,
    limit: maxRecentSearches,
  });
}

function readSavedSearches() {
  return readStoredSearches({
    cache: savedCache(),
    key: savedStorageKey,
    limit: maxSavedSearches,
  });
}

function getRecentSnapshot() {
  if (typeof window === "undefined") return [];

  return readRecentSearches();
}

function getSavedSnapshot() {
  if (typeof window === "undefined") return [];

  return readSavedSearches();
}

function subscribeToRecentSearches(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(storageEventName, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEventName, callback);
  };
}

function subscribeToSavedSearches(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(savedStorageEventName, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(savedStorageEventName, callback);
  };
}

function emitRecentSearchUpdate() {
  window.dispatchEvent(new Event(storageEventName));
}

function emitSavedSearchUpdate() {
  window.dispatchEvent(new Event(savedStorageEventName));
}

function writeRecentSearches(searches: RecentSearch[]) {
  localStorage.setItem(storageKey, JSON.stringify(searches.slice(0, maxRecentSearches)));
  emitRecentSearchUpdate();
}

function writeSavedSearches(searches: RecentSearch[]) {
  localStorage.setItem(savedStorageKey, JSON.stringify(searches.slice(0, maxSavedSearches)));
  emitSavedSearchUpdate();
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
  const savedSearches = useSyncExternalStore(
    subscribeToSavedSearches,
    getSavedSnapshot,
    () => [],
  );
  const hasCurrent = Boolean(
    normalizedCurrent.q ||
      normalizedCurrent.category ||
      normalizedCurrent.city ||
      normalizedCurrent.region,
  );
  const currentSearch = useMemo(
    () => ({
      ...normalizedCurrent,
      href: hrefFor(normalizedCurrent),
      label: searchLabel(normalizedCurrent),
    }),
    [normalizedCurrent],
  );
  const currentIsSaved = savedSearches.some(
    (search) => search.href === currentSearch.href,
  );

  useEffect(() => {
    const stored = readRecentSearches();

    if (!hasCurrent) return;

    const deduped = stored.filter((search) => search.href !== currentSearch.href);
    const next = [currentSearch, ...deduped].slice(0, maxRecentSearches);

    writeRecentSearches(next);
  }, [currentSearch, hasCurrent]);

  if (!recentSearches.length && !savedSearches.length && !hasCurrent) return null;

  return (
    <section className="mt-4 space-y-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_82%,transparent)] p-3">
      {hasCurrent ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_78%,transparent)] px-3 py-2">
          <p className="min-w-0 truncate text-xs font-semibold text-[var(--muted-strong)]">
            {currentSearch.label}
          </p>
          <button
            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-bold ${
              currentIsSaved
                ? "border-[color-mix(in_srgb,var(--gold)_55%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_16%,var(--paper-warm))] text-[var(--foreground)]"
                : "border-[var(--card-rim)] text-[var(--muted-strong)]"
            }`}
            onClick={() => {
              if (currentIsSaved) {
                writeSavedSearches(
                  savedSearches.filter(
                    (search) => search.href !== currentSearch.href,
                  ),
                );
              } else {
                writeSavedSearches([currentSearch, ...savedSearches]);
              }
            }}
            type="button"
          >
            <Bookmark className="size-3" />
            {currentIsSaved ? "Saved" : "Save"}
          </button>
        </div>
      ) : null}
      {savedSearches.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-strong)]">
              <Bookmark className="size-4 text-[var(--brand-gold)]" />
              Saved searches
            </div>
            <button
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--card-rim)] px-2 text-xs font-semibold text-[var(--muted-strong)]"
              onClick={() => {
                localStorage.removeItem(savedStorageKey);
                emitSavedSearchUpdate();
              }}
              type="button"
            >
              <X className="size-3" />
              Clear
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedSearches.map((search) => (
              <Link
                className="ttc-surface flex h-9 shrink-0 items-center rounded-md border px-3 text-xs font-semibold"
                href={search.href}
                key={search.href}
              >
                {search.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {recentSearches.length ? (
        <div>
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
        </div>
      ) : null}
    </section>
  );
}
