/**
 * Selects the highest-scoring campaign whose advertiser exists in the curated
 * public profile projection. Filtering before scoring prevents an ineligible
 * top campaign from suppressing a lower eligible campaign.
 *
 * @template {{ advertiser_id: string, bid_cents: number, city: string | null, country_code: string | null, language: string | null, region: string | null }} TCampaign
 * @template TAdvertiser
 * @param {readonly TCampaign[]} campaigns
 * @param {ReadonlyMap<string, TAdvertiser>} advertiserProfiles
 * @param {{ city?: string | null, countryCode?: string | null, language?: string | null, region?: string | null }} context
 * @returns {{ advertiser: TAdvertiser, campaign: TCampaign } | null}
 */
export function selectPublicSponsoredCampaign(
  campaigns,
  advertiserProfiles,
  { city = null, countryCode = null, language = null, region = null },
) {
  let selected = null;
  let selectedScore = Number.NEGATIVE_INFINITY;

  for (const campaign of campaigns) {
    const advertiser = advertiserProfiles.get(campaign.advertiser_id);
    if (!advertiser) continue;

    const score =
      campaign.bid_cents +
      (countryCode && campaign.country_code === countryCode ? 250 : 0) +
      (language && campaign.language === language ? 200 : 0) +
      (region && campaign.region === region ? 150 : 0) +
      (city && campaign.city === city ? 200 : 0);

    if (!selected || score > selectedScore) {
      selected = { advertiser, campaign };
      selectedScore = score;
    }
  }

  return selected;
}
