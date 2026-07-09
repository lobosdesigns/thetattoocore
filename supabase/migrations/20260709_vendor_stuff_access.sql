alter table public.license_verification_requests
  drop constraint if exists license_verification_requests_account_type_check;

alter table public.license_verification_requests
  add constraint license_verification_requests_account_type_check
  check (account_type in ('artist', 'studio', 'vendor'));

drop policy if exists "Users can submit own license verification"
  on public.license_verification_requests;
create policy "Users can submit own license verification"
  on public.license_verification_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = profile_id
    and account_type in ('artist', 'studio', 'vendor')
  );

drop policy if exists "Sellers manage listings"
  on public.marketplace_listings;
drop policy if exists "Verified professionals manage Stuff listings"
  on public.marketplace_listings;
create policy "Verified professionals manage Stuff listings"
  on public.marketplace_listings for all
  to authenticated
  using (
    seller_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles seller
      where seller.id = (select auth.uid())
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  )
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles seller
      where seller.id = (select auth.uid())
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  );

drop policy if exists "Sellers manage listing media"
  on public.marketplace_media;
drop policy if exists "Verified professionals manage Stuff media"
  on public.marketplace_media;
create policy "Verified professionals manage Stuff media"
  on public.marketplace_media for all
  to authenticated
  using (
    exists (
      select 1
      from public.marketplace_listings
      join public.profiles seller
        on seller.id = marketplace_listings.seller_id
      where marketplace_listings.id = marketplace_media.listing_id
        and marketplace_listings.seller_id = (select auth.uid())
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  )
  with check (
    exists (
      select 1
      from public.marketplace_listings
      join public.profiles seller
        on seller.id = marketplace_listings.seller_id
      where marketplace_listings.id = marketplace_media.listing_id
        and marketplace_listings.seller_id = (select auth.uid())
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  );
