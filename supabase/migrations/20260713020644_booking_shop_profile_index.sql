create index if not exists booking_requests_shop_profile_created_idx
  on public.booking_requests (shop_profile_id, created_at desc)
  where shop_profile_id is not null;
