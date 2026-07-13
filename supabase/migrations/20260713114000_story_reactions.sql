create table if not exists public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.story_posts(id) on delete cascade,
  reactor_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_reactions_unique_member unique (story_id, reactor_id),
  constraint story_reactions_allowed_check check (
    reaction in ('fire', 'heart', 'clap', 'hundred', 'flash', 'sparkles')
  )
);

alter table public.story_reactions enable row level security;

drop policy if exists "Members can read own or received story reactions" on public.story_reactions;
create policy "Members can read own or received story reactions"
  on public.story_reactions for select
  to authenticated
  using (
    reactor_id = (select auth.uid())
    or exists (
      select 1
      from public.story_posts
      where story_posts.id = story_reactions.story_id
      and story_posts.author_id = (select auth.uid())
    )
  );

drop policy if exists "Members react to visible stories" on public.story_reactions;
create policy "Members react to visible stories"
  on public.story_reactions for insert
  to authenticated
  with check (
    reactor_id = (select auth.uid())
    and exists (
      select 1
      from public.story_posts
      where story_posts.id = story_reactions.story_id
      and story_posts.author_id <> (select auth.uid())
      and story_posts.moderation_status = 'active'
      and story_posts.expires_at > now()
      and story_posts.visibility in ('public_preview', 'members')
    )
  );

drop policy if exists "Members update own story reactions" on public.story_reactions;
create policy "Members update own story reactions"
  on public.story_reactions for update
  to authenticated
  using (reactor_id = (select auth.uid()))
  with check (
    reactor_id = (select auth.uid())
    and exists (
      select 1
      from public.story_posts
      where story_posts.id = story_reactions.story_id
      and story_posts.author_id <> (select auth.uid())
      and story_posts.moderation_status = 'active'
      and story_posts.expires_at > now()
      and story_posts.visibility in ('public_preview', 'members')
    )
  );

drop policy if exists "Members remove own story reactions" on public.story_reactions;
create policy "Members remove own story reactions"
  on public.story_reactions for delete
  to authenticated
  using (reactor_id = (select auth.uid()));

grant select, insert, update, delete on public.story_reactions to authenticated;

create index if not exists story_reactions_story_created_idx
  on public.story_reactions (story_id, created_at desc);

create index if not exists story_reactions_reactor_created_idx
  on public.story_reactions (reactor_id, created_at desc);
