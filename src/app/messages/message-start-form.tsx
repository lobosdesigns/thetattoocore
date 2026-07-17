"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Search, Send } from "lucide-react";
import { MediaInput } from "@/app/media-input";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { ProfileAvatar } from "@/app/profile-avatar";
import { WordLimitedField } from "@/app/word-limited-field";
import { startConversation } from "./actions";

type ConnectedProfile = {
  account_type: string;
  avatar_url: string | null;
  city: string | null;
  display_name: string;
  id: string;
  region: string | null;
  username: string;
};

function cleanUsername(value: string) {
  return value
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

function searchableText(profile: ConnectedProfile) {
  return [
    profile.username,
    profile.display_name,
    profile.account_type,
    profile.city,
    profile.region,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function profileLocation(profile: ConnectedProfile) {
  return [profile.city, profile.region].filter(Boolean).join(", ");
}

function canSendToTarget(value: string) {
  return /^[a-z0-9_]{3,30}$/.test(value);
}

function matchScore(profile: ConnectedProfile, terms: string[]) {
  if (!terms.length) return 0;

  let score = 0;

  for (const term of terms) {
    const username = profile.username.toLowerCase();
    const displayName = profile.display_name.toLowerCase();
    const accountType = profile.account_type.toLowerCase();
    const city = profile.city?.toLowerCase() ?? "";
    const region = profile.region?.toLowerCase() ?? "";

    if (username === term) score += 100;
    else if (username.startsWith(term)) score += 70;
    else if (username.includes(term)) score += 45;

    if (displayName === term) score += 80;
    else if (displayName.startsWith(term)) score += 52;
    else if (displayName.includes(term)) score += 32;

    if (city.startsWith(term)) score += 22;
    else if (city.includes(term)) score += 12;

    if (region.startsWith(term)) score += 18;
    else if (region.includes(term)) score += 10;

    if (accountType.includes(term)) score += 10;
  }

  return score;
}

export function MessageStartForm({
  connectedProfiles,
  imageAccept,
  prefillUsername,
}: {
  connectedProfiles: ConnectedProfile[];
  imageAccept: string;
  prefillUsername: string;
}) {
  const [query, setQuery] = useState(prefillUsername);
  const [selectedUsername, setSelectedUsername] = useState(prefillUsername);
  const cleanQuery = cleanUsername(query);
  const targetUsername = selectedUsername || cleanQuery;
  const canSend = canSendToTarget(targetUsername);
  const selectedProfile = connectedProfiles.find(
    (profile) => profile.username === selectedUsername,
  );
  const filteredProfiles = useMemo(() => {
    const terms = query
      .toLowerCase()
      .replace(/^@/, "")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    const matches = connectedProfiles.filter((profile) => {
      if (!terms.length) return true;

      const haystack = searchableText(profile);
      return terms.every(
        (term) => haystack.includes(term) || profile.username.includes(term),
      );
    });

    return matches
      .sort((a, b) => {
        const scoreDiff = matchScore(b, terms) - matchScore(a, terms);

        if (scoreDiff !== 0) return scoreDiff;

        return a.display_name.localeCompare(b.display_name);
      })
      .slice(0, 8);
  }, [connectedProfiles, query]);

  function updateQuery(value: string) {
    setQuery(value);
    setSelectedUsername("");
  }

  function selectProfile(profile: ConnectedProfile) {
    setQuery(`@${profile.username}`);
    setSelectedUsername(profile.username);
  }

  return (
    <form action={startConversation} className="space-y-3" encType="multipart/form-data">
      <input name="username" type="hidden" value={targetUsername} />
      <div className="space-y-2">
        <label
          className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-strong)]"
          htmlFor="dm-username-search"
        >
          Followers, following, and active DMs
        </label>
        <div className="ttc-surface flex items-center gap-2 rounded-md border px-3">
          <Search className="size-4 text-[var(--muted-strong)]" />
          <input
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            id="dm-username-search"
            maxLength={80}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search followers, following, or username"
            title="Search followers, following, active DMs, or type an exact username."
            type="search"
            value={query}
          />
        </div>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Tap someone from your followers, following, or existing DMs. You can
          also type an exact username and send if the member is not listed yet.
        </p>
        {selectedProfile ? (
          <p className="ttc-surface rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
            Ready to message @{selectedProfile.username}.
          </p>
        ) : query && canSend ? (
          <p className="ttc-surface rounded-md border px-3 py-2 text-xs text-[var(--muted-strong)]">
            Ready to try exact username @{targetUsername}. Tap a listed profile
            when one appears, or send to try this username.
          </p>
        ) : query ? (
          <p className="ttc-surface rounded-md border px-3 py-2 text-xs text-[var(--muted-strong)]">
            Keep typing, or tap a matching profile below.
          </p>
        ) : null}
        {connectedProfiles.length ? (
          <div className="grid max-h-52 gap-2 overflow-y-auto pr-1">
            {filteredProfiles.length ? (
              filteredProfiles.map((profile) => {
                const active = targetUsername === profile.username;

                return (
                  <button
                    aria-pressed={active}
                    className={`ttc-surface flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left ${
                      active
                        ? "border-[color-mix(in_srgb,var(--gold)_58%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_16%,var(--paper-warm))]"
                        : "hover:bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)]"
                    }`}
                    key={profile.id}
                    onClick={() => selectProfile(profile)}
                    type="button"
                  >
                    <ProfileAvatar profile={profile} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {profile.display_name}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted-strong)]">
                        @{profile.username}
                        {profileLocation(profile)
                          ? ` - ${profileLocation(profile)}`
                          : ""}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="ttc-surface rounded-md border px-3 py-2 text-xs text-[var(--muted-strong)]">
                No connected profiles or active DMs matched that search. Type
                the exact username if you know it, then send to try it.
              </p>
            )}
          </div>
        ) : (
          <p className="ttc-surface rounded-md border px-3 py-2 text-xs text-[var(--muted-strong)]">
            No followers, following, or active DMs found yet. Type an exact
            username to start a DM.
          </p>
        )}
      </div>
      <WordLimitedField
        as="textarea"
        className="ttc-surface min-h-20 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
        emojiShortcuts
        maxCharacters={4000}
        maxLength={4000}
        name="body"
        placeholder="Start a message"
        wrapperClassName="space-y-2"
      />
      <details className="ttc-surface rounded-md border p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
          <ImagePlus className="size-4" />
          Attach photo
        </summary>
        <div className="mt-3">
          <MediaInput
            accept={imageAccept}
            compact
            maxImageBytes={10 * 1024 * 1024}
            name="media"
            videoAllowed={false}
          />
        </div>
      </details>
      <PendingSubmitButton
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
        disabled={!canSend}
        pendingLabel="Sending"
      >
        <Send className="size-4" />
        Send
      </PendingSubmitButton>
    </form>
  );
}
