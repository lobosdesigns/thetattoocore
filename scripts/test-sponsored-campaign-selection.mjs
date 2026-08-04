import assert from "node:assert/strict";

import { selectPublicSponsoredCampaign } from "../src/lib/ads/sponsored-campaign-selection.mjs";

const publicProfiles = new Map([
  ["public-low", { id: "public-low", username: "public_low" }],
  ["public-targeted", { id: "public-targeted", username: "public_targeted" }],
  ["public-high", { id: "public-high", username: "public_high" }],
]);

const hiddenTopCampaign = {
  advertiser_id: "hidden-top",
  bid_cents: 50_000,
  city: "Austin",
  country_code: "US",
  language: "en",
  region: "TX",
};
const publicLowerCampaign = {
  advertiser_id: "public-low",
  bid_cents: 100,
  city: null,
  country_code: null,
  language: null,
  region: null,
};

const hiddenFallback = selectPublicSponsoredCampaign(
  [hiddenTopCampaign, publicLowerCampaign],
  publicProfiles,
  { city: "Austin", countryCode: "US", language: "en", region: "TX" },
);
assert.equal(
  hiddenFallback?.campaign,
  publicLowerCampaign,
  "a hidden highest-scoring advertiser cannot suppress a lower eligible public campaign",
);
assert.equal(
  hiddenFallback?.advertiser,
  publicProfiles.get("public-low"),
  "the selected public campaign carries its curated advertiser projection",
);

assert.equal(
  selectPublicSponsoredCampaign([hiddenTopCampaign], publicProfiles, {}),
  null,
  "selection fails closed when no campaign has a curated public advertiser",
);

const targetedCampaign = {
  advertiser_id: "public-targeted",
  bid_cents: 500,
  city: "Austin",
  country_code: "US",
  language: "en",
  region: "TX",
};
const higherBidCampaign = {
  advertiser_id: "public-high",
  bid_cents: 1_000,
  city: null,
  country_code: null,
  language: null,
  region: null,
};
assert.equal(
  selectPublicSponsoredCampaign(
    [higherBidCampaign, targetedCampaign],
    publicProfiles,
    { city: "Austin", countryCode: "US", language: "en", region: "TX" },
  )?.campaign,
  targetedCampaign,
  "location and language weights rank only eligible public campaigns",
);

assert.equal(
  selectPublicSponsoredCampaign(
    [publicLowerCampaign, { ...publicLowerCampaign }],
    publicProfiles,
    {},
  )?.campaign,
  publicLowerCampaign,
  "equal-score selection preserves query order",
);

console.log("All sponsored campaign selection checks passed.");
