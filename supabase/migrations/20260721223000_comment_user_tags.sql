create table if not exists public.post_comment_tags (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  tagged_profile_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, tagged_profile_id),
  constraint post_comment_tags_no_self_tag_check check (tagged_profile_id <> tagged_by)
);

create table if not exists public.thread_comment_tags (
  comment_id uuid not null references public.thread_comments(id) on delete cascade,
  tagged_profile_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, tagged_profile_id),
  constraint thread_comment_tags_no_self_tag_check check (tagged_profile_id <> tagged_by)
);

alter table public.post_comment_tags enable row level security;
alter table public.thread_comment_tags enable row level security;

drop policy if exists "Visible post comment tags can be read" on public.post_comment_tags;
create policy "Visible post comment tags can be read"
  on public.post_comment_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.post_comments
      join public.feed_posts on feed_posts.id = post_comments.post_id
      where post_comments.id = post_comment_tags.comment_id
        and post_comments.deleted_at is null
        and public.current_user_can_view_feed_post(
          feed_posts.author_id,
          feed_posts.visibility,
          feed_posts.is_sensitive,
          feed_posts.is_published,
          feed_posts.moderation_status
        )
        and not exists (
          select 1
          from public.post_comment_hides
          where post_comment_hides.comment_id = post_comments.id
            and post_comment_hides.hidden_by = (select auth.uid())
        )
    )
  );

drop policy if exists "Authors tag own post comments" on public.post_comment_tags;
create policy "Authors tag own post comments"
  on public.post_comment_tags
  for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_tags.comment_id
        and post_comments.author_id = (select auth.uid())
        and post_comments.deleted_at is null
    )
  );

drop policy if exists "Authors remove own post comment tags" on public.post_comment_tags;
create policy "Authors remove own post comment tags"
  on public.post_comment_tags
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.post_comments
      where post_comments.id = post_comment_tags.comment_id
        and post_comments.author_id = (select auth.uid())
    )
  );

drop policy if exists "Visible thread comment tags can be read" on public.thread_comment_tags;
create policy "Visible thread comment tags can be read"
  on public.thread_comment_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.thread_comments
      join public.thread_posts on thread_posts.id = thread_comments.thread_id
      where thread_comments.id = thread_comment_tags.comment_id
        and thread_comments.deleted_at is null
        and public.current_user_can_view_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
        )
        and not exists (
          select 1
          from public.thread_comment_hides
          where thread_comment_hides.comment_id = thread_comments.id
            and thread_comment_hides.hidden_by = (select auth.uid())
        )
    )
  );

drop policy if exists "Authors tag own thread comments" on public.thread_comment_tags;
create policy "Authors tag own thread comments"
  on public.thread_comment_tags
  for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_tags.comment_id
        and thread_comments.author_id = (select auth.uid())
        and thread_comments.deleted_at is null
    )
  );

drop policy if exists "Authors remove own thread comment tags" on public.thread_comment_tags;
create policy "Authors remove own thread comment tags"
  on public.thread_comment_tags
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.thread_comments
      where thread_comments.id = thread_comment_tags.comment_id
        and thread_comments.author_id = (select auth.uid())
    )
  );

drop policy if exists "Comment owners can delete comment tag notifications" on public.notifications;
create policy "Comment owners can delete comment tag notifications"
  on public.notifications
  for delete
  to authenticated
  using (
    (
      subject_type = 'post_comment'
      and exists (
        select 1
        from public.post_comments
        join public.feed_posts on feed_posts.id = post_comments.post_id
        where post_comments.id = notifications.subject_id
          and (
            post_comments.author_id = (select auth.uid())
            or feed_posts.author_id = (select auth.uid())
          )
      )
    )
    or (
      subject_type = 'thread_comment'
      and exists (
        select 1
        from public.thread_comments
        join public.thread_posts on thread_posts.id = thread_comments.thread_id
        where thread_comments.id = notifications.subject_id
          and (
            thread_comments.author_id = (select auth.uid())
            or thread_posts.author_id = (select auth.uid())
          )
      )
    )
  );

drop trigger if exists prevent_restricted_post_comment_tags on public.post_comment_tags;
create trigger prevent_restricted_post_comment_tags
before insert or update on public.post_comment_tags
for each row execute function public.prevent_restricted_profile_write('tagged_by');

drop trigger if exists prevent_restricted_thread_comment_tags on public.thread_comment_tags;
create trigger prevent_restricted_thread_comment_tags
before insert or update on public.thread_comment_tags
for each row execute function public.prevent_restricted_profile_write('tagged_by');

create index if not exists post_comment_tags_tagged_profile_created_idx
  on public.post_comment_tags (tagged_profile_id, created_at desc);

create index if not exists post_comment_tags_tagged_by_created_idx
  on public.post_comment_tags (tagged_by, created_at desc);

create index if not exists thread_comment_tags_tagged_profile_created_idx
  on public.thread_comment_tags (tagged_profile_id, created_at desc);

create index if not exists thread_comment_tags_tagged_by_created_idx
  on public.thread_comment_tags (tagged_by, created_at desc);

grant select on public.post_comment_tags to anon, authenticated;
grant insert, delete on public.post_comment_tags to authenticated;
grant select on public.thread_comment_tags to anon, authenticated;
grant insert, delete on public.thread_comment_tags to authenticated;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'follow_request',
      'follow_accepted',
      'message',
      'feed_like',
      'feed_comment',
      'feed_tag',
      'feed_comment_tag',
      'thread_like',
      'thread_comment',
      'thread_tag',
      'thread_comment_tag',
      'gig_tag',
      'new_follow',
      'verification_approved',
      'verification_rejected',
      'merch_paid',
      'merch_fulfilled',
      'merch_refunded',
      'merch_payment_failed',
      'merch_cancelled',
      'ad_paid',
      'ad_payment_failed',
      'ad_refunded',
      'booking_request',
      'booking_accepted',
      'booking_declined',
      'booking_cancelled',
      'booking_deposit_paid',
      'booking_payment_failed',
      'booking_refunded',
      'story_reaction'
    )
  );
