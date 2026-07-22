create or replace function private.current_user_has_block_relationship(
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and target_profile_id <> (select auth.uid())
    and exists (
      select 1
      from public.user_blocks relationship
      where (
        relationship.blocker_id = (select auth.uid())
        and relationship.blocked_id = target_profile_id
      )
      or (
        relationship.blocker_id = target_profile_id
        and relationship.blocked_id = (select auth.uid())
      )
    );
$$;

revoke all on function private.current_user_has_block_relationship(uuid)
  from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.current_user_has_block_relationship(uuid)
  to anon, authenticated;

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
      or not private.current_user_has_block_relationship(author_profile_id)
    )
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
      or not private.current_user_has_block_relationship(author_profile_id)
    )
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

create or replace function public.current_user_can_view_gig(
  poster_profile_id uuid,
  gig_visibility public.content_visibility,
  gig_is_sensitive boolean,
  gig_status text,
  gig_moderation_status public.content_moderation_status
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    gig_status = 'active'
    and gig_moderation_status = 'active'
    and (
      poster_profile_id = (select auth.uid())
      or not private.current_user_has_block_relationship(poster_profile_id)
    )
    and (
      poster_profile_id = (select auth.uid())
      or (
        gig_visibility = 'public_preview'
        and (
          not gig_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
      or (
        gig_visibility = 'members'
        and (select auth.uid()) is not null
        and (
          not gig_is_sensitive
          or public.current_user_can_view_sensitive_content()
        )
      )
    );
$$;

revoke all on function public.current_user_can_view_gig(
  uuid,
  public.content_visibility,
  boolean,
  text,
  public.content_moderation_status
) from public;
grant execute on function public.current_user_can_view_gig(
  uuid,
  public.content_visibility,
  boolean,
  text,
  public.content_moderation_status
) to anon, authenticated;

drop policy if exists "Visible gigs can be read" on public.gigs;
create policy "Visible gigs can be read"
  on public.gigs for select
  using (
    public.current_user_can_view_gig(
      poster_id,
      visibility,
      is_sensitive,
      status,
      moderation_status
    )
  );

drop policy if exists "Gig media follows gig visibility" on public.gig_media;
create policy "Gig media follows gig visibility"
  on public.gig_media for select
  using (
    exists (
      select 1
      from public.gigs
      where gigs.id = gig_media.gig_id
        and public.current_user_can_view_gig(
          gigs.poster_id,
          gigs.visibility,
          gigs.is_sensitive,
          gigs.status,
          gigs.moderation_status
        )
    )
  );

drop policy if exists "Visible gig tags can be read" on public.gig_tags;
create policy "Visible gig tags can be read"
  on public.gig_tags for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.gigs
      where gigs.id = gig_tags.gig_id
        and public.current_user_can_view_gig(
          gigs.poster_id,
          gigs.visibility,
          gigs.is_sensitive,
          gigs.status,
          gigs.moderation_status
        )
    )
  );
