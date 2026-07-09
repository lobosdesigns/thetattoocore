create type public.ad_campaign_type as enum ('artist_growth', 'stuff_listing');
create type public.ad_campaign_goal as enum (
  'leads',
  'messages',
  'engagement',
  'listing_views',
  'seller_messages',
  'marketplace_engagement'
);
create type public.ad_campaign_status as enum (
  'draft',
  'pending_review',
  'approved',
  'active',
  'paused',
  'rejected',
  'archived'
);
create type public.ad_placement as enum ('4u', 'gossip', 'stuff');

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.profiles(id) on delete cascade,
  campaign_type public.ad_campaign_type not null,
  goal public.ad_campaign_goal not null,
  status public.ad_campaign_status not null default 'draft',
  name text not null check (char_length(name) between 3 and 120),
  title text not null check (char_length(title) between 3 and 120),
  body text check (body is null or char_length(body) <= 300),
  target_url text check (target_url is null or char_length(target_url) <= 500),
  bid_cents integer not null default 0 check (bid_cents between 0 and 100000),
  daily_budget_cents integer not null default 0 check (daily_budget_cents between 0 and 10000000),
  country_code text check (country_code is null or char_length(country_code) = 2),
  region text check (region is null or char_length(region) <= 80),
  city text check (city is null or char_length(city) <= 80),
  language text check (language is null or char_length(language) between 2 and 8),
  keywords text[] not null default '{}'::text[],
  starts_at timestamptz,
  ends_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaign_goal_matches_type check (
    (
      campaign_type = 'artist_growth'
      and goal in ('leads', 'messages', 'engagement')
    )
    or (
      campaign_type = 'stuff_listing'
      and goal in ('listing_views', 'seller_messages', 'marketplace_engagement')
    )
  ),
  constraint ad_campaign_dates_check check (
    starts_at is null
    or ends_at is null
    or ends_at > starts_at
  )
);

create table public.ad_campaign_placements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  placement public.ad_placement not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, placement)
);

create table public.ad_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  placement public.ad_placement not null,
  event_type text not null check (event_type in ('impression', 'click', 'message_lead')),
  viewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (campaign_id, placement)
    references public.ad_campaign_placements(campaign_id, placement)
    on delete cascade
);

alter table public.ad_campaigns enable row level security;
alter table public.ad_campaign_placements enable row level security;
alter table public.ad_events enable row level security;

create policy "Active ads are publicly readable"
  on public.ad_campaigns for select
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

create policy "Advertisers can view own ad campaigns"
  on public.ad_campaigns for select
  to authenticated
  using (
    advertiser_id = (select auth.uid())
    or private.current_user_can_moderate()
  );

create policy "Advertisers can create own ad campaigns"
  on public.ad_campaigns for insert
  to authenticated
  with check (
    advertiser_id = (select auth.uid())
    and status in ('draft', 'pending_review')
  );

create policy "Advertisers can edit own draft ad campaigns"
  on public.ad_campaigns for update
  to authenticated
  using (
    advertiser_id = (select auth.uid())
    and status in ('draft', 'pending_review', 'paused')
  )
  with check (
    advertiser_id = (select auth.uid())
    and status in ('draft', 'pending_review', 'paused')
  );

create policy "Moderators can review ad campaigns"
  on public.ad_campaigns for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

create policy "Active ad placements are publicly readable"
  on public.ad_campaign_placements for select
  using (
    exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_campaign_placements.campaign_id
        and ad_campaigns.status = 'active'
        and (ad_campaigns.starts_at is null or ad_campaigns.starts_at <= now())
        and (ad_campaigns.ends_at is null or ad_campaigns.ends_at > now())
    )
  );

create policy "Advertisers can view own ad placements"
  on public.ad_campaign_placements for select
  to authenticated
  using (
    exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_campaign_placements.campaign_id
        and (
          ad_campaigns.advertiser_id = (select auth.uid())
          or private.current_user_can_moderate()
        )
    )
  );

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
        )
    )
  );

create policy "Ad events can be created"
  on public.ad_events for insert
  with check (
    exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_events.campaign_id
        and ad_campaigns.status = 'active'
        and (ad_campaigns.starts_at is null or ad_campaigns.starts_at <= now())
        and (ad_campaigns.ends_at is null or ad_campaigns.ends_at > now())
    )
  );

create policy "Advertisers and moderators can view ad events"
  on public.ad_events for select
  to authenticated
  using (
    private.current_user_can_moderate()
    or exists (
      select 1
      from public.ad_campaigns
      where ad_campaigns.id = ad_events.campaign_id
        and ad_campaigns.advertiser_id = (select auth.uid())
    )
  );

create index ad_campaigns_status_type_idx
  on public.ad_campaigns (status, campaign_type, created_at desc);

create index ad_campaigns_advertiser_idx
  on public.ad_campaigns (advertiser_id, created_at desc);

create index ad_campaign_placements_placement_idx
  on public.ad_campaign_placements (placement, campaign_id);

create index ad_events_campaign_created_idx
  on public.ad_events (campaign_id, created_at desc);

grant select on public.ad_campaigns to anon, authenticated;
grant insert, update on public.ad_campaigns to authenticated;
grant select on public.ad_campaign_placements to anon, authenticated;
grant insert, update, delete on public.ad_campaign_placements to authenticated;
grant select, insert on public.ad_events to anon, authenticated;
