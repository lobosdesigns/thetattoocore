alter table public.ad_campaigns
  drop constraint if exists ad_campaign_goal_matches_type;

alter table public.ad_campaigns
  add constraint ad_campaign_goal_matches_type check (
    (
      campaign_type = 'artist_growth'
      and goal in ('leads', 'messages', 'engagement')
    )
    or (
      campaign_type = 'stuff_listing'
      and goal in ('listing_views', 'seller_messages', 'marketplace_engagement')
    )
    or (
      campaign_type = 'merch_listing'
      and goal in ('product_views', 'shop_visits', 'purchases')
    )
  );

drop policy if exists "Advertisers can manage own draft ad placements"
  on public.ad_campaign_placements;

create policy "Advertisers can manage own draft ad placements"
  on public.ad_campaign_placements for all
  to authenticated
  using (
    exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_campaign_placements.campaign_id
        and ad_campaigns.advertiser_id = (select auth.uid())
        and ad_campaigns.status in ('draft', 'pending_review', 'paused')
    )
  )
  with check (
    exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_campaign_placements.campaign_id
        and ad_campaigns.advertiser_id = (select auth.uid())
        and ad_campaigns.status in ('draft', 'pending_review', 'paused')
        and (
          (
            ad_campaigns.campaign_type = 'artist_growth'
            and ad_campaign_placements.placement in ('4u', 'gossip')
          )
          or (
            ad_campaigns.campaign_type = 'stuff_listing'
            and ad_campaign_placements.placement = 'stuff'
          )
          or (
            ad_campaigns.campaign_type = 'merch_listing'
            and ad_campaign_placements.placement = 'merch'
          )
        )
    )
  );
