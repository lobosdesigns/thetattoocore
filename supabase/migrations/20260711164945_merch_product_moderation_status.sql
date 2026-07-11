alter table public.merch_products
  add column if not exists moderation_status public.content_moderation_status not null default 'active';

create index if not exists merch_products_moderation_status_created_idx
  on public.merch_products (moderation_status, created_at desc);

drop policy if exists "Active merch products are publicly readable"
  on public.merch_products;
create policy "Active merch products are publicly readable"
  on public.merch_products for select
  using (
    status = 'active'
    and moderation_status = 'active'
  );

drop policy if exists "Merch media follows product visibility"
  on public.merch_product_media;
create policy "Merch media follows product visibility"
  on public.merch_product_media for select
  using (
    exists (
      select 1
      from public.merch_products
      where merch_products.id = merch_product_media.product_id
        and merch_products.status = 'active'
        and merch_products.moderation_status = 'active'
    )
  );
