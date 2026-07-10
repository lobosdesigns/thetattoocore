drop policy if exists "Members can view conversations"
  on public.conversations;
create policy "Members can view conversations"
  on public.conversations for select
  to authenticated
  using (
    private.current_user_is_conversation_member(id)
    or created_by = (select auth.uid())
  );

drop policy if exists "Members can view members"
  on public.conversation_members;
create policy "Members can view members"
  on public.conversation_members for select
  to authenticated
  using (
    private.current_user_is_conversation_member(conversation_id)
    or exists (
      select 1
      from public.conversations
      where conversations.id = conversation_members.conversation_id
        and conversations.created_by = (select auth.uid())
    )
  );
