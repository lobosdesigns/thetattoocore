create or replace function public.current_user_is_verified_artist_or_shop()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and viewer.account_type in ('artist', 'studio')
      and viewer.license_verified_at is not null
  );
$$;

create or replace function public.current_user_can_view_feed_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_is_published boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    post_is_published
    and post_moderation_status = 'active'
    and (
      author_profile_id = (select auth.uid())
      or (
        post_visibility = 'public_preview'
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'followers'
        and public.current_user_is_accepted_follower(author_profile_id)
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'verified_artists_shops'
        and public.current_user_is_verified_artist_or_shop()
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
    );
$$;

create or replace function public.current_user_can_view_thread_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    post_moderation_status = 'active'
    and (
      author_profile_id = (select auth.uid())
      or (
        post_visibility = 'public_preview'
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'followers'
        and public.current_user_is_accepted_follower(author_profile_id)
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'verified_artists_shops'
        and public.current_user_is_verified_artist_or_shop()
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        post_visibility = 'verified_professionals'
        and public.current_user_is_verified_artist_or_vendor()
        and (
          not post_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
    );
$$;

create or replace function public.current_user_can_interact_with_feed_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_is_published boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and public.current_user_can_view_feed_post(
      author_profile_id,
      post_visibility,
      post_is_sensitive,
      post_is_published,
      post_moderation_status
    )
    and (
      author_profile_id = (select auth.uid())
      or post_visibility in (
        'public_preview',
        'members',
        'followers',
        'verified_artists_shops'
      )
    );
$$;

create or replace function public.current_user_can_interact_with_thread_post(
  author_profile_id uuid,
  post_visibility public.content_visibility,
  post_is_sensitive boolean,
  post_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and public.current_user_can_view_thread_post(
      author_profile_id,
      post_visibility,
      post_is_sensitive,
      post_moderation_status
    )
    and (
      author_profile_id = (select auth.uid())
      or post_visibility in (
        'public_preview',
        'members',
        'followers',
        'verified_artists_shops',
        'verified_professionals'
      )
    );
$$;

revoke all on function public.current_user_is_verified_artist_or_shop() from public;
grant execute on function public.current_user_is_verified_artist_or_shop() to anon, authenticated;

drop policy if exists "Authors manage feed posts" on public.feed_posts;
create policy "Authors manage feed posts"
  on public.feed_posts for all
  to authenticated
  using ((select auth.uid()) = author_id)
  with check (
    (select auth.uid()) = author_id
    and visibility in (
      'public_preview',
      'members',
      'followers',
      'verified_artists_shops',
      'private'
    )
    and (
      visibility <> 'verified_artists_shops'
      or public.current_user_is_verified_artist_or_shop()
    )
  );

drop policy if exists "Users create thread posts" on public.thread_posts;
create policy "Users create thread posts"
  on public.thread_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      visibility <> 'verified_professionals'
      or public.current_user_is_verified_artist_or_vendor()
    )
    and (
      visibility <> 'verified_artists_shops'
      or public.current_user_is_verified_artist_or_shop()
    )
  );

drop policy if exists "Users update own thread posts" on public.thread_posts;
create policy "Users update own thread posts"
  on public.thread_posts for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check (
    (select auth.uid()) = author_id
    and (
      visibility <> 'verified_professionals'
      or public.current_user_is_verified_artist_or_vendor()
    )
    and (
      visibility <> 'verified_artists_shops'
      or public.current_user_is_verified_artist_or_shop()
    )
  );
