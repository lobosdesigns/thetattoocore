grant update (last_read_at) on table public.conversation_members
  to authenticated;

drop policy if exists "Users can update own conversation read state"
  on public.conversation_members;
create policy "Users can update own conversation read state"
  on public.conversation_members for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on policy "Users can update own conversation read state"
  on public.conversation_members is
  'Allows a participant to mark only their own conversation membership as read.';

-- Verification:
-- set local role authenticated;
-- select has_column_privilege('authenticated', 'public.conversation_members', 'last_read_at', 'update') as authenticated_can_update_last_read_at;
-- Rollback:
-- drop policy if exists "Users can update own conversation read state" on public.conversation_members;
-- revoke update (last_read_at) on table public.conversation_members from authenticated;
