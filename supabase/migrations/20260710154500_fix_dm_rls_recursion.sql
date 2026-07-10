create or replace function private.current_user_is_conversation_member(
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
    from public.conversation_members
    where conversation_members.conversation_id = target_conversation_id
      and conversation_members.user_id = (select auth.uid())
  );
$$;

revoke all on function private.current_user_is_conversation_member(uuid)
  from public, anon;
grant execute on function private.current_user_is_conversation_member(uuid)
  to authenticated;

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
    or created_by = (select auth.uid())
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

drop policy if exists "Members can read messages"
  on public.messages;
create policy "Members can read messages"
  on public.messages for select
  to authenticated
  using (private.current_user_is_conversation_member(conversation_id));

drop policy if exists "Members can send messages"
  on public.messages;
create policy "Members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.current_user_is_conversation_member(conversation_id)
    and not exists (
      select 1
      from public.conversation_members other_members
      join public.user_blocks
        on (
          user_blocks.blocker_id = messages.sender_id
          and user_blocks.blocked_id = other_members.user_id
        )
        or (
          user_blocks.blocker_id = other_members.user_id
          and user_blocks.blocked_id = messages.sender_id
        )
      where other_members.conversation_id = messages.conversation_id
        and other_members.user_id <> messages.sender_id
    )
  );

drop policy if exists "Members can read message attachments"
  on public.message_attachments;
create policy "Members can read message attachments"
  on public.message_attachments for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages
      where messages.id = message_attachments.message_id
        and private.current_user_is_conversation_member(messages.conversation_id)
    )
  );

drop policy if exists "Members can send message attachments"
  on public.message_attachments;
create policy "Members can send message attachments"
  on public.message_attachments for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.messages
      where messages.id = message_attachments.message_id
        and messages.sender_id = (select auth.uid())
        and private.current_user_is_conversation_member(messages.conversation_id)
    )
  );

drop policy if exists "Members can read message media"
  on storage.objects;
create policy "Members can read message media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-media'
    and exists (
      select 1
      from public.message_attachments
      join public.messages
        on messages.id = message_attachments.message_id
      where message_attachments.storage_bucket = storage.objects.bucket_id
        and message_attachments.storage_path = storage.objects.name
        and private.current_user_is_conversation_member(messages.conversation_id)
    )
  );
