alter table public.follows
  add column if not exists status text not null default 'accepted',
  add column if not exists responded_at timestamptz,
  drop constraint if exists follows_status_check;

alter table public.follows
  add constraint follows_status_check
  check (status in ('pending', 'accepted'));

update public.follows
set status = 'accepted'
where status is null;

create index if not exists follows_following_status_idx
  on public.follows (following_id, status, created_at desc);

create index if not exists follows_follower_status_idx
  on public.follows (follower_id, status, created_at desc);

drop policy if exists "Follows are public" on public.follows;
create policy "Visible follows can be read"
  on public.follows for select
  using (
    status = 'accepted'
    or follower_id = (select auth.uid())
    or following_id = (select auth.uid())
  );

drop policy if exists "Users can follow" on public.follows;
create policy "Users can request or follow"
  on public.follows for insert
  to authenticated
  with check (
    (select auth.uid()) = follower_id
    and (
      status = 'pending'
      or exists (
        select 1 from public.profiles target
        where target.id = following_id
        and not target.is_private
      )
    )
  );

drop policy if exists "Profile owners can accept follow requests" on public.follows;
create policy "Profile owners can accept follow requests"
  on public.follows for update
  to authenticated
  using ((select auth.uid()) = following_id)
  with check (
    (select auth.uid()) = following_id
    and status = 'accepted'
  );

drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow or decline requests"
  on public.follows for delete
  to authenticated
  using (
    (select auth.uid()) = follower_id
    or (select auth.uid()) = following_id
  );
