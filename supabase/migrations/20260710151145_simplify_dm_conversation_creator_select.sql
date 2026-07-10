drop policy if exists "Members can view conversations"
  on public.conversations;
create policy "Members can view conversations"
  on public.conversations for select
  to authenticated
  using (
    private.current_user_is_conversation_member(id)
    or created_by = (select auth.uid())
  );
