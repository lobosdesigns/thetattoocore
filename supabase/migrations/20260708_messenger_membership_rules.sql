alter table public.conversations
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

drop policy if exists "Authenticated users can create conversations"
  on public.conversations;

create policy "Users create own conversations"
  on public.conversations for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "Users can add themselves to conversations"
  on public.conversation_members;

create policy "Users can add conversation members"
  on public.conversation_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.conversations
      where conversations.id = conversation_members.conversation_id
      and conversations.created_by = (select auth.uid())
    )
  );

create index if not exists conversations_created_by_idx
  on public.conversations (created_by);

create index if not exists conversation_members_conversation_idx
  on public.conversation_members (conversation_id);

create index if not exists messages_sender_idx
  on public.messages (sender_id);
