create or replace function private.current_user_created_conversation(
  target_conversation_id uuid
)
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select exists (
    select 1
    from public.conversations
    where conversations.id = target_conversation_id
      and conversations.created_by = (select auth.uid())
  );
$$;

revoke all on function private.current_user_created_conversation(uuid)
  from public, anon;
grant execute on function private.current_user_created_conversation(uuid)
  to authenticated;

drop policy if exists "Members can view conversations"
  on public.conversations;
create policy "Members can view conversations"
  on public.conversations for select
  to authenticated
  using (
    private.current_user_is_conversation_member(id)
    or private.current_user_created_conversation(id)
  );

drop policy if exists "Users can add conversation members"
  on public.conversation_members;
create policy "Users can add conversation members"
  on public.conversation_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or (
      private.current_user_created_conversation(conversation_id)
      and not exists (
        select 1
        from public.user_blocks
        where (
          user_blocks.blocker_id = (select auth.uid())
          and user_blocks.blocked_id = conversation_members.user_id
        )
        or (
          user_blocks.blocker_id = conversation_members.user_id
          and user_blocks.blocked_id = (select auth.uid())
        )
      )
    )
  );

drop policy if exists "Members can view members"
  on public.conversation_members;
create policy "Members can view members"
  on public.conversation_members for select
  to authenticated
  using (
    private.current_user_is_conversation_member(conversation_id)
    or private.current_user_created_conversation(conversation_id)
  );
