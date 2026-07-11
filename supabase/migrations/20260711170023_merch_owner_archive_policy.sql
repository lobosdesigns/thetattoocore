drop policy if exists "Verified sellers can archive own merch products"
  on public.merch_products;
create policy "Verified sellers can archive own merch products"
  on public.merch_products for update
  to authenticated
  using (
    seller_id = (select auth.uid())
    and not is_official
    and status in ('draft', 'pending_review', 'approved', 'active', 'paused', 'rejected')
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
    and not is_official
    and status = 'archived'
    and is_indexable = false
    and exists (
      select 1
      from public.profiles seller
      where seller.id = (select auth.uid())
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  );
