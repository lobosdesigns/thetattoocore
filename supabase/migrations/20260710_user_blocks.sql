create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, created_at desc);

drop policy if exists "Users can view block relationships involving them"
  on public.user_blocks;
create policy "Users can view block relationships involving them"
  on public.user_blocks for select
  to authenticated
  using (
    blocker_id = (select auth.uid())
    or blocked_id = (select auth.uid())
    or private.current_user_can_moderate()
  );

drop policy if exists "Users can block profiles"
  on public.user_blocks;
create policy "Users can block profiles"
  on public.user_blocks for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists "Users can unblock profiles they blocked"
  on public.user_blocks;
create policy "Users can unblock profiles they blocked"
  on public.user_blocks for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

grant select, insert, delete on public.user_blocks to authenticated;

drop policy if exists "Users can add conversation members"
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
      and not exists (
        select 1 from public.user_blocks
        where (
          user_blocks.blocker_id = conversations.created_by
          and user_blocks.blocked_id = conversation_members.user_id
        )
        or (
          user_blocks.blocker_id = conversation_members.user_id
          and user_blocks.blocked_id = conversations.created_by
        )
      )
    )
  );

drop policy if exists "Members can send messages"
  on public.messages;
create policy "Members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_members
      where conversation_members.conversation_id = messages.conversation_id
      and conversation_members.user_id = (select auth.uid())
    )
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
