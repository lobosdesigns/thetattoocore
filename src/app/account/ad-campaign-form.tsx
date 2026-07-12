"use client";

import { useState } from "react";
import { PendingSubmitButton } from "../pending-submit-button";

type CampaignType = "artist_growth" | "stuff_listing" | "merch_listing";

type CampaignConfig = {
  goals: [string, string][];
  label: string;
  placements: string[];
  placementLabel: string;
  summary: string;
};

const campaignConfigs: Record<CampaignType, CampaignConfig> = {
  artist_growth: {
    goals: [
      ["leads", "Leads"],
      ["messages", "Messages"],
      ["engagement", "Engagement"],
    ],
    label: "Artist growth",
    placementLabel: "4U + Gossip",
    placements: ["4u", "gossip"],
    summary: "Leads, messages, engagement",
  },
  stuff_listing: {
    goals: [
      ["listing_views", "Stuff listing views"],
      ["seller_messages", "Stuff seller messages"],
      ["marketplace_engagement", "Stuff marketplace engagement"],
    ],
    label: "Stuff listing",
    placementLabel: "Stuff only",
    placements: ["stuff"],
    summary: "Listing views, seller messages",
  },
  merch_listing: {
    goals: [
      ["product_views", "Merch product views"],
      ["shop_visits", "Merch shop visits"],
      ["purchases", "Merch purchases"],
    ],
    label: "Merch listing",
    placementLabel: "Merch only",
    placements: ["merch"],
    summary: "Product views, shop visits, purchases",
  },
};

const placementLabels: Record<string, string> = {
  "4u": "4U",
  gossip: "Gossip",
  merch: "Merch",
  stuff: "Stuff",
};

export function AdCampaignForm({
  action,
  city,
  countryCode,
  countryOptions,
  language,
  languageOptions,
  region,
}: {
  action: (formData: FormData) => void | Promise<void>;
  city: string;
  countryCode: string;
  countryOptions: readonly (readonly [string, string])[];
  language: string;
  languageOptions: readonly (readonly [string, string])[];
  region: string;
}) {
  const [campaignType, setCampaignType] = useState<CampaignType>("artist_growth");
  const [goal, setGoal] = useState(campaignConfigs.artist_growth.goals[0][0]);
  const [placements, setPlacements] = useState<string[]>(
    campaignConfigs.artist_growth.placements,
  );
  const allowedPlacements = campaignConfigs[campaignType].placements;

  function updateCampaignType(value: string) {
    const nextType = (Object.keys(campaignConfigs) as CampaignType[]).includes(
      value as CampaignType,
    )
      ? (value as CampaignType)
      : "artist_growth";
    const nextConfig = campaignConfigs[nextType];

    setCampaignType(nextType);
    setGoal(nextConfig.goals[0][0]);
    setPlacements(nextConfig.placements);
  }

  function togglePlacement(value: string) {
    if (!allowedPlacementsHas(value)) return;

    setPlacements((current) => {
      if (current.includes(value)) {
        const next = current.filter((placement) => placement !== value);
        return next.length ? next : current;
      }

      return [...current, value].filter((placement) =>
        allowedPlacementsHas(placement),
      );
    });
  }

  function allowedPlacementsHas(value: string) {
    return allowedPlacements.includes(value);
  }

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2 text-xs leading-5 text-[var(--muted)] sm:grid-cols-3">
        {(Object.keys(campaignConfigs) as CampaignType[]).map((type) => {
          const config = campaignConfigs[type];
          const isActive = type === campaignType;

          return (
            <button
              className={`rounded-md border p-3 text-left transition ${
                isActive
                  ? "border-[color-mix(in_srgb,var(--gold)_70%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_14%,var(--paper-warm))]"
                  : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)]"
              }`}
              key={type}
              onClick={() => updateCampaignType(type)}
              type="button"
            >
              <p className="font-semibold text-[var(--foreground)]">{config.label}</p>
              <p className="mt-1">{config.placementLabel}</p>
              <p className="mt-1 text-[var(--muted-strong)]">{config.summary}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Campaign type</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            name="campaign_type"
            onChange={(event) => updateCampaignType(event.target.value)}
            required
            value={campaignType}
          >
            {(Object.keys(campaignConfigs) as CampaignType[]).map((type) => (
              <option key={type} value={type}>
                {campaignConfigs[type].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Goal</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            name="goal"
            onChange={(event) => setGoal(event.target.value)}
            required
            value={goal}
          >
            {campaignConfigs[campaignType].goals.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Campaign name</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            maxLength={120}
            name="name"
            placeholder="Austin flash booking push"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ad headline</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            maxLength={120}
            name="title"
            placeholder="Books open for July"
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Ad text</span>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 py-3 text-sm outline-none focus:border-[var(--foreground)]"
          maxLength={300}
          name="body"
          placeholder="Short ad copy for the sponsored card."
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Target link</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            name="target_url"
            placeholder="https://..."
            type="url"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Keywords</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            name="keywords"
            placeholder="blackwork, flash, fine line"
          />
        </label>
      </div>

      <fieldset className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-3">
        <legend className="px-1 text-sm font-semibold">Placements</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {Object.entries(placementLabels).map(([value, label]) => {
            const isAllowed = allowedPlacementsHas(value);

            return (
              <label
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                  isAllowed
                    ? "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]"
                    : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] text-[var(--muted-strong)]"
                }`}
                key={value}
              >
                <input
                  checked={placements.includes(value)}
                  disabled={!isAllowed}
                  name="placements"
                  onChange={() => togglePlacement(value)}
                  type="checkbox"
                  value={value}
                />
                {label}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--muted-strong)]">
          {campaignConfigs[campaignType].label} campaigns use{" "}
          {campaignConfigs[campaignType].placementLabel.toLowerCase()}.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Bid per spot</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            min="0"
            name="bid_dollars"
            placeholder="0.00"
            step="0.01"
            type="number"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Daily cap</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            min="0"
            name="daily_budget_dollars"
            placeholder="0.00"
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="text-sm font-medium">City</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={city}
            name="city"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Region</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={region}
            name="region"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Country</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm uppercase outline-none focus:border-[var(--foreground)]"
            defaultValue={countryCode}
            name="country_code"
          >
            <option value="">Any country</option>
            {countryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Language</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
            defaultValue={language}
            name="language"
          >
            <option value="">Any language</option>
            {languageOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]">
        Ads are reviewed before they run and appear with a sponsored label.
        Targeting uses coarse location, language, selected placement, and keywords
        only.
      </p>

      <PendingSubmitButton
        className="h-11 rounded-md bg-[var(--foreground)] px-5 text-sm font-semibold text-[var(--background)]"
        pendingLabel="Submitting"
      >
        Submit ad for review
      </PendingSubmitButton>
    </form>
  );
}
