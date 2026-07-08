do $$
begin
  create type public.content_visibility as enum (
    'public_preview',
    'members',
    'private'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_moderation_status as enum (
    'active',
    'under_review',
    'hidden',
    'removed'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.feed_posts
  add column if not exists visibility public.content_visibility not null default 'public_preview',
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists sensitive_reason text,
  add column if not exists moderation_status public.content_moderation_status not null default 'active',
  add column if not exists is_indexable boolean not null default true;

alter table public.thread_posts
  add column if not exists visibility public.content_visibility not null default 'members',
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists sensitive_reason text,
  add column if not exists moderation_status public.content_moderation_status not null default 'active',
  add column if not exists is_indexable boolean not null default false;

alter table public.marketplace_listings
  add column if not exists visibility public.content_visibility not null default 'public_preview',
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists sensitive_reason text,
  add column if not exists moderation_status public.content_moderation_status not null default 'active',
  add column if not exists is_indexable boolean not null default true;

alter table public.feed_media
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists sensitive_reason text;

alter table public.thread_media
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists sensitive_reason text;

alter table public.marketplace_media
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists sensitive_reason text;

alter table public.feed_posts
  drop constraint if exists feed_posts_sensitive_reason_check;

alter table public.feed_posts
  add constraint feed_posts_sensitive_reason_check
  check (
    not is_sensitive
    or sensitive_reason in ('body_art_nudity', 'healing', 'scar_cover', 'piercing', 'other')
  );

alter table public.thread_posts
  drop constraint if exists thread_posts_sensitive_reason_check;

alter table public.thread_posts
  add constraint thread_posts_sensitive_reason_check
  check (
    not is_sensitive
    or sensitive_reason in ('body_art_nudity', 'healing', 'scar_cover', 'piercing', 'other')
  );

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_sensitive_reason_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_sensitive_reason_check
  check (
    not is_sensitive
    or sensitive_reason in ('body_art_nudity', 'healing', 'scar_cover', 'piercing', 'other')
  );

create index if not exists feed_posts_visibility_status_created_idx
  on public.feed_posts (visibility, moderation_status, is_sensitive, created_at desc);

create index if not exists thread_posts_visibility_status_created_idx
  on public.thread_posts (visibility, moderation_status, is_sensitive, created_at desc);

create index if not exists marketplace_visibility_status_created_idx
  on public.marketplace_listings (visibility, moderation_status, is_sensitive, created_at desc);

drop policy if exists "Published feed posts are public" on public.feed_posts;
create policy "Visible feed posts can be read"
  on public.feed_posts for select
  using (
    is_published
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
    )
  );

drop policy if exists "Feed media is public for published posts" on public.feed_media;
create policy "Visible feed media can be read"
  on public.feed_media for select
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = feed_media.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        (
          feed_posts.visibility = 'public_preview'
          and (not feed_posts.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          feed_posts.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or feed_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Likes are public" on public.post_likes;
create policy "Visible post likes can be read"
  on public.post_likes for select
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = post_likes.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        (
          feed_posts.visibility = 'public_preview'
          and (not feed_posts.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          feed_posts.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or feed_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users can like" on public.post_likes;
create policy "Users can like visible posts"
  on public.post_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.feed_posts
      where feed_posts.id = post_likes.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        feed_posts.visibility in ('public_preview', 'members')
        or feed_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Comments are public" on public.post_comments;
create policy "Visible post comments can be read"
  on public.post_comments for select
  using (
    exists (
      select 1 from public.feed_posts
      where feed_posts.id = post_comments.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        (
          feed_posts.visibility = 'public_preview'
          and (not feed_posts.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          feed_posts.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or feed_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users can comment" on public.post_comments;
create policy "Users can comment on visible posts"
  on public.post_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.feed_posts
      where feed_posts.id = post_comments.post_id
      and feed_posts.is_published
      and feed_posts.moderation_status = 'active'
      and (
        feed_posts.visibility in ('public_preview', 'members')
        or feed_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Thread posts are public" on public.thread_posts;
create policy "Visible thread posts can be read"
  on public.thread_posts for select
  using (
    moderation_status = 'active'
    and (
      (
        visibility = 'public_preview'
        and (not is_sensitive or (select auth.uid()) is not null)
      )
      or (
        visibility = 'members'
        and (select auth.uid()) is not null
      )
    )
  );

drop policy if exists "Thread media follows thread visibility" on public.thread_media;
create policy "Thread media follows thread visibility"
  on public.thread_media for select
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_media.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        (
          thread_posts.visibility = 'public_preview'
          and (not thread_posts.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          thread_posts.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or thread_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Thread likes are public" on public.thread_likes;
create policy "Visible thread likes can be read"
  on public.thread_likes for select
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_likes.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        (
          thread_posts.visibility = 'public_preview'
          and (not thread_posts.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          thread_posts.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or thread_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users can like threads" on public.thread_likes;
create policy "Users can like visible threads"
  on public.thread_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_likes.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.visibility in ('public_preview', 'members')
        or thread_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Thread comments are public" on public.thread_comments;
create policy "Visible thread comments can be read"
  on public.thread_comments for select
  using (
    exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_comments.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        (
          thread_posts.visibility = 'public_preview'
          and (not thread_posts.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          thread_posts.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or thread_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users can comment on threads" on public.thread_comments;
create policy "Users can comment on visible threads"
  on public.thread_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.thread_posts
      where thread_posts.id = thread_comments.thread_id
      and thread_posts.moderation_status = 'active'
      and (
        thread_posts.visibility in ('public_preview', 'members')
        or thread_posts.author_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Active marketplace listings are public" on public.marketplace_listings;
create policy "Visible marketplace listings can be read"
  on public.marketplace_listings for select
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
      or seller_id = (select auth.uid())
    )
  );

drop policy if exists "Marketplace media follows listing visibility" on public.marketplace_media;
create policy "Marketplace media follows listing visibility"
  on public.marketplace_media for select
  using (
    exists (
      select 1 from public.marketplace_listings
      where marketplace_listings.id = marketplace_media.listing_id
      and marketplace_listings.status = 'active'
      and marketplace_listings.moderation_status = 'active'
      and (
        (
          marketplace_listings.visibility = 'public_preview'
          and (not marketplace_listings.is_sensitive or (select auth.uid()) is not null)
        )
        or (
          marketplace_listings.visibility = 'members'
          and (select auth.uid()) is not null
        )
        or marketplace_listings.seller_id = (select auth.uid())
      )
    )
  );
