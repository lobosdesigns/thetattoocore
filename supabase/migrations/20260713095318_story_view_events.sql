create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.story_posts(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (story_id, viewer_id)
);

alter table public.story_views enable row level security;

drop policy if exists "Members can record visible story views" on public.story_views;
create policy "Members can record visible story views"
  on public.story_views for insert
  to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (
      select 1
      from public.story_posts
      where story_posts.id = story_views.story_id
      and story_posts.author_id <> (select auth.uid())
      and story_posts.moderation_status = 'active'
      and story_posts.expires_at > now()
      and (
        story_posts.visibility = 'public_preview'
        or story_posts.visibility = 'members'
      )
    )
  );

drop policy if exists "Members can refresh own story view timestamp" on public.story_views;
create policy "Members can refresh own story view timestamp"
  on public.story_views for update
  to authenticated
  using (viewer_id = (select auth.uid()))
  with check (
    viewer_id = (select auth.uid())
    and exists (
      select 1
      from public.story_posts
      where story_posts.id = story_views.story_id
      and story_posts.author_id <> (select auth.uid())
      and story_posts.moderation_status = 'active'
      and story_posts.expires_at > now()
    )
  );

drop policy if exists "Members can read own story views" on public.story_views;
create policy "Members can read own story views"
  on public.story_views for select
  to authenticated
  using (viewer_id = (select auth.uid()));

drop policy if exists "Authors can read their story views" on public.story_views;
create policy "Authors can read their story views"
  on public.story_views for select
  to authenticated
  using (
    exists (
      select 1
      from public.story_posts
      where story_posts.id = story_views.story_id
      and story_posts.author_id = (select auth.uid())
    )
  );

grant select, insert, update on public.story_views to authenticated;

create index if not exists story_views_story_viewed_idx
  on public.story_views (story_id, viewed_at desc);

create index if not exists story_views_viewer_viewed_idx
  on public.story_views (viewer_id, viewed_at desc);
