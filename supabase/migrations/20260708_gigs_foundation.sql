create table if not exists public.gigs (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text,
  category text not null default 'job' check (
    category in (
      'job',
      'convention',
      'guest_spot',
      'shop_opening',
      'apprenticeship',
      'event'
    )
  ),
  city text,
  region text,
  country text default 'US',
  starts_at timestamptz,
  ends_at timestamptz,
  compensation text,
  contact_url text,
  status text not null default 'active' check (
    status in ('active', 'filled', 'archived')
  ),
  visibility public.content_visibility not null default 'public_preview',
  is_sensitive boolean not null default false,
  sensitive_reason text,
  moderation_status public.content_moderation_status not null default 'active',
  is_indexable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gigs_sensitive_reason_check
    check (
      not is_sensitive
      or sensitive_reason in (
        'body_art_nudity',
        'healing',
        'scar_cover',
        'piercing',
        'other'
      )
    )
);

create table if not exists public.gig_media (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  sort_order integer not null default 0,
  is_sensitive boolean not null default false,
  sensitive_reason text,
  created_at timestamptz not null default now()
);

alter table public.gigs enable row level security;
alter table public.gig_media enable row level security;

drop policy if exists "Visible gigs can be read" on public.gigs;
create policy "Visible gigs can be read"
  on public.gigs for select
  using (
    status = 'active'
    and moderation_status = 'active'
    and (
      (
        visibility = 'public_preview'
        and (not is_sensitive or (select auth.uid()) is not null)
      )
      or (
        visibility = 'members'
        and (select auth.uid()) is not null
      )
      or poster_id = (select auth.uid())
    )
  );

drop policy if exists "Users create own gigs" on public.gigs;
create policy "Users create own gigs"
  on public.gigs for insert
  to authenticated
  with check ((select auth.uid()) = poster_id);

drop policy if exists "Users update own gigs" on public.gigs;
create policy "Users update own gigs"
  on public.gigs for update
  to authenticated
  using ((select auth.uid()) = poster_id)
  with check ((select auth.uid()) = poster_id);

drop policy if exists "Gig media follows gig visibility" on public.gig_media;
create policy "Gig media follows gig visibility"
  on public.gig_media for select
  using (
    exists (
      select 1 from public.gigs
      where gigs.id = gig_media.gig_id
      and gigs.status = 'active'
      and gigs.moderation_status = 'active'
      and (
        (
          gigs.visibility = 'public_preview'
          and (not gigs.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          gigs.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or gigs.poster_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users manage own gig media" on public.gig_media;
create policy "Users manage own gig media"
  on public.gig_media for all
  to authenticated
  using (
    exists (
      select 1 from public.gigs
      where gigs.id = gig_media.gig_id
      and gigs.poster_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.gigs
      where gigs.id = gig_media.gig_id
      and gigs.poster_id = (select auth.uid())
    )
  );

create index if not exists gigs_visibility_status_created_idx
  on public.gigs (visibility, moderation_status, is_sensitive, created_at desc);

create index if not exists gigs_category_location_created_idx
  on public.gigs (category, country, region, city, created_at desc);

create index if not exists gigs_poster_created_idx
  on public.gigs (poster_id, created_at desc);

create index if not exists gig_media_gig_idx
  on public.gig_media (gig_id, sort_order);

grant select, insert, update on public.gigs to authenticated;
grant select on public.gigs to anon;
grant select, insert, update, delete on public.gig_media to authenticated;
grant select on public.gig_media to anon;
