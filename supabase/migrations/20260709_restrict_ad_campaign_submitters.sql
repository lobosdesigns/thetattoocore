drop policy if exists "Advertisers can create own ad campaigns" on public.ad_campaigns;
create policy "Verified pros can create own ad campaigns"
  on public.ad_campaigns for insert
  to authenticated
  with check (
    advertiser_id = (select auth.uid())
    and status in ('draft', 'pending_review')
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.account_type in ('artist', 'studio', 'vendor')
        and profiles.license_verified_at is not null
        and profiles.suspended_at is null
        and profiles.banned_at is null
    )
  );

drop policy if exists "Advertisers can edit own draft ad campaigns" on public.ad_campaigns;
create policy "Verified pros can edit own draft ad campaigns"
  on public.ad_campaigns for update
  to authenticated
  using (
    advertiser_id = (select auth.uid())
    and status in ('draft', 'pending_review', 'paused')
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.account_type in ('artist', 'studio', 'vendor')
        and profiles.license_verified_at is not null
        and profiles.suspended_at is null
        and profiles.banned_at is null
    )
  )
  with check (
    advertiser_id = (select auth.uid())
    and status in ('draft', 'pending_review', 'paused')
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.account_type in ('artist', 'studio', 'vendor')
        and profiles.license_verified_at is not null
        and profiles.suspended_at is null
        and profiles.banned_at is null
    )
  );
