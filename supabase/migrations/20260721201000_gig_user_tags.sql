create table if not exists public.gig_tags (
  gig_id uuid not null references public.gigs(id) on delete cascade,
  tagged_profile_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gig_id, tagged_profile_id),
  constraint gig_tags_no_self_tag_check check (tagged_profile_id <> tagged_by)
);

alter table public.gig_tags enable row level security;

drop policy if exists "Visible gig tags can be read" on public.gig_tags;
create policy "Visible gig tags can be read"
  on public.gig_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.gigs
      where gigs.id = gig_tags.gig_id
        and gigs.status = 'active'
        and gigs.moderation_status = 'active'
        and (
          gigs.poster_id = (select auth.uid())
          or (
            gigs.visibility = 'public_preview'
            and (
              not gigs.is_sensitive
              or public.current_user_can_view_sensitive_content()
            )
          )
          or (
            gigs.visibility = 'members'
            and (select auth.uid()) is not null
            and (
              not gigs.is_sensitive
              or public.current_user_can_view_sensitive_content()
            )
          )
        )
    )
  );

drop policy if exists "Authors tag own gigs" on public.gig_tags;
create policy "Authors tag own gigs"
  on public.gig_tags
  for insert
  to authenticated
  with check (
    tagged_by = (select auth.uid())
    and exists (
      select 1
      from public.gigs
      where gigs.id = gig_tags.gig_id
        and gigs.poster_id = (select auth.uid())
    )
  );

drop policy if exists "Authors remove own gig tags" on public.gig_tags;
create policy "Authors remove own gig tags"
  on public.gig_tags
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.gigs
      where gigs.id = gig_tags.gig_id
        and gigs.poster_id = (select auth.uid())
    )
  );

drop trigger if exists prevent_restricted_gig_tags on public.gig_tags;
create trigger prevent_restricted_gig_tags
before insert or update on public.gig_tags
for each row execute function public.prevent_restricted_profile_write('tagged_by');

create index if not exists gig_tags_tagged_profile_created_idx
  on public.gig_tags (tagged_profile_id, created_at desc);

create index if not exists gig_tags_tagged_by_created_idx
  on public.gig_tags (tagged_by, created_at desc);

grant select on public.gig_tags to anon, authenticated;
grant insert, delete on public.gig_tags to authenticated;

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
