create table if not exists public.help_article_comments (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.help_article_comments(id) on delete cascade,
  body text not null,
  status text not null default 'pending_review',
  is_official_answer boolean not null default false,
  is_pinned boolean not null default false,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint help_article_comments_status_check
    check (status in ('pending_review', 'visible', 'hidden', 'removed')),
  constraint help_article_comments_body_length_check
    check (char_length(trim(body)) between 3 and 800),
  constraint help_article_comments_article_slug_check
    check (article_slug ~ '^[a-z0-9-]{3,120}$')
);

alter table public.help_article_comments enable row level security;

create index if not exists help_article_comments_article_created_idx
  on public.help_article_comments (article_slug, created_at desc);

create index if not exists help_article_comments_visible_idx
  on public.help_article_comments (article_slug, is_pinned desc, created_at desc)
  where status = 'visible';

create index if not exists help_article_comments_author_idx
  on public.help_article_comments (author_id, created_at desc);

drop policy if exists "Visible help comments are public" on public.help_article_comments;
create policy "Visible help comments are public"
  on public.help_article_comments for select
  to anon, authenticated
  using (status = 'visible');

drop policy if exists "Authors can read own help comments" on public.help_article_comments;
create policy "Authors can read own help comments"
  on public.help_article_comments for select
  to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Moderators can read help comments" on public.help_article_comments;
create policy "Moderators can read help comments"
  on public.help_article_comments for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
      and profiles.role in ('moderator', 'admin', 'owner')
    )
  );

drop policy if exists "Members can submit help comments" on public.help_article_comments;
create policy "Members can submit help comments"
  on public.help_article_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and status = 'pending_review'
    and is_official_answer = false
    and is_pinned = false
    and reviewed_by is null
    and reviewed_at is null
    and hidden_at is null
  );

drop policy if exists "Moderators can update help comments" on public.help_article_comments;
create policy "Moderators can update help comments"
  on public.help_article_comments for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
      and profiles.role in ('moderator', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
      and profiles.role in ('moderator', 'admin', 'owner')
    )
  );

grant select on public.help_article_comments to anon, authenticated;
grant insert, update on public.help_article_comments to authenticated;
