create type public.merch_product_status as enum (
  'draft',
  'pending_review',
  'approved',
  'active',
  'paused',
  'rejected',
  'archived'
);

create type public.merch_product_category as enum (
  'apparel',
  'print',
  'art',
  'sticker',
  'accessory',
  'official',
  'other'
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'merch-media',
  'merch-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.merch_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 4000),
  category public.merch_product_category not null default 'other',
  status public.merch_product_status not null default 'draft',
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (
    compare_at_price_cents is null
    or compare_at_price_cents >= price_cents
  ),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  sku text check (sku is null or char_length(sku) <= 80),
  inventory_quantity integer not null default 0 check (inventory_quantity >= 0),
  inventory_reserved integer not null default 0 check (
    inventory_reserved >= 0
    and inventory_reserved <= inventory_quantity
  ),
  shipping_required boolean not null default true,
  ships_from_country text default 'US' check (
    ships_from_country is null
    or char_length(ships_from_country) = 2
  ),
  ships_from_region text check (
    ships_from_region is null
    or char_length(ships_from_region) <= 80
  ),
  ships_from_city text check (
    ships_from_city is null
    or char_length(ships_from_city) <= 80
  ),
  stripe_product_id text unique,
  stripe_price_id text unique,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 1000),
  is_official boolean not null default false,
  is_indexable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merch_products_official_requires_admin_review check (
    not is_official
    or category = 'official'
  )
);

create table public.merch_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.merch_products(id) on delete cascade,
  storage_bucket text not null default 'merch-media',
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(8,2) check (
    duration_seconds is null
    or duration_seconds <= 60
  ),
  alt_text text check (alt_text is null or char_length(alt_text) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

alter table public.merch_products enable row level security;
alter table public.merch_product_media enable row level security;

create policy "Active merch products are publicly readable"
  on public.merch_products for select
  using (
    status = 'active'
  );

create policy "Sellers and moderators can view merch products"
  on public.merch_products for select
  to authenticated
  using (
    seller_id = (select auth.uid())
    or private.current_user_can_moderate()
  );

create policy "Verified sellers can create merch products"
  on public.merch_products for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and status in ('draft', 'pending_review')
    and not is_official
    and exists (
      select 1
      from public.profiles seller
      where seller.id = (select auth.uid())
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  );

create policy "Verified sellers can update own non-live merch products"
  on public.merch_products for update
  to authenticated
  using (
    seller_id = (select auth.uid())
    and status in ('draft', 'pending_review', 'paused', 'rejected')
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
    and status in ('draft', 'pending_review', 'paused', 'rejected')
    and not is_official
    and exists (
      select 1
      from public.profiles seller
      where seller.id = (select auth.uid())
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  );

create policy "Moderators can review merch products"
  on public.merch_products for update
  to authenticated
  using (private.current_user_can_moderate())
  with check (private.current_user_can_moderate());

create policy "Merch media follows product visibility"
  on public.merch_product_media for select
  using (
    exists (
      select 1
      from public.merch_products
      where merch_products.id = merch_product_media.product_id
        and merch_products.status = 'active'
    )
  );

create policy "Sellers and moderators can view merch media"
  on public.merch_product_media for select
  to authenticated
  using (
    exists (
      select 1
      from public.merch_products
      where merch_products.id = merch_product_media.product_id
        and (
          merch_products.seller_id = (select auth.uid())
          or private.current_user_can_moderate()
        )
    )
  );

create policy "Verified sellers manage own merch media"
  on public.merch_product_media for all
  to authenticated
  using (
    exists (
      select 1
      from public.merch_products
      join public.profiles seller
        on seller.id = merch_products.seller_id
      where merch_products.id = merch_product_media.product_id
        and merch_products.seller_id = (select auth.uid())
        and merch_products.status in ('draft', 'pending_review', 'paused', 'rejected')
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  )
  with check (
    storage_bucket = 'merch-media'
    and exists (
      select 1
      from public.merch_products
      join public.profiles seller
        on seller.id = merch_products.seller_id
      where merch_products.id = merch_product_media.product_id
        and merch_products.seller_id = (select auth.uid())
        and merch_products.status in ('draft', 'pending_review', 'paused', 'rejected')
        and seller.license_verified_at is not null
        and seller.account_type in ('artist', 'studio', 'vendor')
    )
  );

drop policy if exists "Merch media is publicly readable"
  on storage.objects;
drop policy if exists "Users upload merch media to own folder"
  on storage.objects;
drop policy if exists "Users update own merch media"
  on storage.objects;
drop policy if exists "Users delete own merch media"
  on storage.objects;

create policy "Merch media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'merch-media');

create policy "Users upload merch media to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'merch-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users update own merch media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'merch-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'merch-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users delete own merch media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'merch-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create index merch_products_status_created_idx
  on public.merch_products (status, created_at desc);

create index merch_products_seller_created_idx
  on public.merch_products (seller_id, created_at desc);

create index merch_products_category_status_idx
  on public.merch_products (category, status, created_at desc);

create index merch_product_media_product_idx
  on public.merch_product_media (product_id, sort_order);

grant select on public.merch_products to anon, authenticated;
grant insert, update on public.merch_products to authenticated;
grant select on public.merch_product_media to anon, authenticated;
grant insert, update, delete on public.merch_product_media to authenticated;
