create table if not exists public.feed_post_tags (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  tagged_profile_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tagged_profile_id),
  constraint feed_post_tags_no_self_tag_check check (tagged_profile_id <> tagged_by)
);

alter table public.feed_post_tags enable row level security;

drop policy if exists "Visible feed post tags can be read" on public.feed_post_tags;
create policy "Visible feed post tags can be read"
  on public.feed_post_tags for select
  using (
    exists (
      select 1
      from public.feed_posts
      where feed_posts.id = feed_post_tags.post_id
        and feed_posts.is_published
        and feed_posts.moderation_status = 'active'
        and (
          (
            feed_posts.visibility = 'public_preview'
            and (
              not feed_posts.is_sensitive
              or exists (
                select 1
                from public.profiles viewer
                where viewer.id = (select auth.uid())
                  and viewer.is_adult_confirmed
                  and viewer.adult_terms_accepted_at is not null
              )
            )
          )
          or (
            feed_posts.visibility = 'members'
            and (select auth.uid()) is not null
            and (
              not feed_posts.is_sensitive
              or exists (
                select 1
                from public.profiles viewer
                where viewer.id = (select auth.uid())
                  and viewer.is_adult_confirmed
                  and viewer.adult_terms_accepted_at is not null
              )
            )
          )
          or feed_posts.author_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Authors tag own feed posts" on public.feed_post_tags;
create policy "Authors tag own feed posts"
  on public.feed_post_tags for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.feed_posts
      where feed_posts.id = feed_post_tags.post_id
        and feed_posts.author_id = (select auth.uid())
    )
  );

drop policy if exists "Authors remove own feed post tags" on public.feed_post_tags;
create policy "Authors remove own feed post tags"
  on public.feed_post_tags for delete
  to authenticated
  using (
    exists (
      select 1
      from public.feed_posts
      where feed_posts.id = feed_post_tags.post_id
        and feed_posts.author_id = (select auth.uid())
    )
  );

drop trigger if exists prevent_restricted_feed_post_tags on public.feed_post_tags;
create trigger prevent_restricted_feed_post_tags
before insert or update on public.feed_post_tags
for each row execute function public.prevent_restricted_profile_write('tagged_by');

grant select on public.feed_post_tags to anon, authenticated;
grant insert, delete on public.feed_post_tags to authenticated;

create index if not exists feed_post_tags_tagged_profile_created_idx
  on public.feed_post_tags (tagged_profile_id, created_at desc);

create index if not exists feed_post_tags_tagged_by_created_idx
  on public.feed_post_tags (tagged_by, created_at desc);
