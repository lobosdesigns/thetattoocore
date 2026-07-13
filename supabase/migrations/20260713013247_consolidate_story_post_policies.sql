drop policy if exists "Visible active stories can be read" on public.story_posts;
drop policy if exists "Moderators can review story posts" on public.story_posts;
drop policy if exists "Users update own stories safely" on public.story_posts;
drop policy if exists "Moderators can update story posts" on public.story_posts;

create policy "Anon can read public active stories"
  on public.story_posts for select
  to anon
  using (
    moderation_status = 'active'
    and expires_at > now()
    and visibility = 'public_preview'
    and not is_sensitive
  );

create policy "Members can read visible or moderated stories"
  on public.story_posts for select
  to authenticated
  using (
    private.current_user_can_moderate()
    or (
      moderation_status = 'active'
      and expires_at > now()
      and (
        (
          visibility = 'public_preview'
          and not is_sensitive
        )
        or visibility = 'members'
        or author_id = (select auth.uid())
      )
    )
  );

create policy "Members update own safe stories or moderate stories"
  on public.story_posts for update
  to authenticated
  using (
    private.current_user_can_moderate()
    or (select auth.uid()) = author_id
  )
  with check (
    private.current_user_can_moderate()
    or (
      (select auth.uid()) = author_id
      and is_sensitive = false
      and (
        sensitive_reason is null
        or sensitive_reason = ''
      )
      and expires_at > created_at
      and expires_at <= created_at + interval '25 hours'
    )
  );
