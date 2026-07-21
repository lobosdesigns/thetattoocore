create table if not exists public.thread_post_tags (
  thread_id uuid not null references public.thread_posts(id) on delete cascade,
  tagged_profile_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, tagged_profile_id),
  constraint thread_post_tags_no_self_tag_check check (tagged_profile_id <> tagged_by)
);

alter table public.thread_post_tags enable row level security;

create policy "Visible thread post tags can be read"
  on public.thread_post_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.thread_posts
      where thread_posts.id = thread_post_tags.thread_id
        and public.current_user_can_view_thread_post(
          thread_posts.author_id,
          thread_posts.visibility,
          thread_posts.is_sensitive,
          thread_posts.moderation_status
        )
    )
  );

create policy "Authors tag own thread posts"
  on public.thread_post_tags
  for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.thread_posts
      where thread_posts.id = thread_post_tags.thread_id
        and thread_posts.author_id = (select auth.uid())
    )
  );

create policy "Authors remove own thread post tags"
  on public.thread_post_tags
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.thread_posts
      where thread_posts.id = thread_post_tags.thread_id
        and thread_posts.author_id = (select auth.uid())
    )
  );

drop trigger if exists prevent_restricted_thread_post_tags on public.thread_post_tags;

create trigger prevent_restricted_thread_post_tags
before insert or update on public.thread_post_tags
for each row execute function public.prevent_restricted_profile_write('tagged_by');

create index if not exists thread_post_tags_tagged_profile_created_idx
  on public.thread_post_tags (tagged_profile_id, created_at desc);

create index if not exists thread_post_tags_tagged_by_created_idx
  on public.thread_post_tags (tagged_by, created_at desc);

grant select on public.thread_post_tags to anon, authenticated;
grant insert, delete on public.thread_post_tags to authenticated;

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
      'thread_like',
      'thread_comment',
      'thread_tag',
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
