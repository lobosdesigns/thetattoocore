drop policy if exists "Users archive own stories" on public.story_posts;
drop policy if exists "Users update own stories safely" on public.story_posts;

create policy "Users update own stories safely"
  on public.story_posts for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check (
    (select auth.uid()) = author_id
    and is_sensitive = false
    and (
      sensitive_reason is null
      or sensitive_reason = ''
    )
    and expires_at > created_at
    and expires_at <= created_at + interval '25 hours'
  );
