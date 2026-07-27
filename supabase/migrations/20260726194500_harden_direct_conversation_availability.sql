create or replace function public.ensure_direct_conversation(
  p_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_available boolean;
  target_available boolean;
  profile_a uuid;
  profile_b uuid;
  target_conversation_id uuid;
  new_conversation_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;

  if p_target_id is null or p_target_id = caller_id then
    raise exception 'Invalid conversation target.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = caller_id
      and suspended_at is null
      and banned_at is null
  )
  into caller_available;

  if not caller_available then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = p_target_id
      and suspended_at is null
      and banned_at is null
      and lower(username) not in (
        'checkouttest',
        'qa_android_dm',
        'ttc_reviewer',
        'ttc_tester'
      )
  )
  into target_available;

  if not target_available then
    raise exception 'Conversation target unavailable.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.user_blocks
    where (
      blocker_id = caller_id
      and blocked_id = p_target_id
    )
    or (
      blocker_id = p_target_id
      and blocked_id = caller_id
    )
  ) then
    raise exception 'Conversation target unavailable.'
      using errcode = '42501';
  end if;

  profile_a := least(caller_id, p_target_id);
  profile_b := greatest(caller_id, p_target_id);

  select conversation_id
  into target_conversation_id
  from public.direct_conversation_pairs
  where profile_low_id = profile_a
    and profile_high_id = profile_b;

  if target_conversation_id is not null then
    return target_conversation_id;
  end if;

  select own_membership.conversation_id
  into target_conversation_id
  from public.conversation_members own_membership
  join public.conversation_members target_membership
    on target_membership.conversation_id = own_membership.conversation_id
    and target_membership.user_id = p_target_id
  join public.conversations
    on conversations.id = own_membership.conversation_id
  where own_membership.user_id = caller_id
  order by conversations.created_at desc, conversations.id desc
  limit 1;

  if target_conversation_id is not null then
    insert into public.direct_conversation_pairs (
      profile_low_id,
      profile_high_id,
      conversation_id
    )
    values (
      profile_a,
      profile_b,
      target_conversation_id
    )
    on conflict (profile_low_id, profile_high_id) do nothing
    returning conversation_id into target_conversation_id;

    if target_conversation_id is null then
      select conversation_id
      into target_conversation_id
      from public.direct_conversation_pairs
      where profile_low_id = profile_a
        and profile_high_id = profile_b;
    end if;

    return target_conversation_id;
  end if;

  insert into public.conversations (created_by)
  values (caller_id)
  returning id into new_conversation_id;

  insert into public.direct_conversation_pairs (
    profile_low_id,
    profile_high_id,
    conversation_id
  )
  values (
    profile_a,
    profile_b,
    new_conversation_id
  )
  on conflict (profile_low_id, profile_high_id) do nothing
  returning conversation_id into target_conversation_id;

  if target_conversation_id is null then
    delete from public.conversations
    where id = new_conversation_id
      and created_by = caller_id;

    select conversation_id
    into target_conversation_id
    from public.direct_conversation_pairs
    where profile_low_id = profile_a
      and profile_high_id = profile_b;

    if target_conversation_id is null then
      raise exception 'Could not start conversation.'
        using errcode = '40001';
    end if;

    return target_conversation_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (target_conversation_id, caller_id),
    (target_conversation_id, p_target_id)
  on conflict (conversation_id, user_id) do nothing;

  return target_conversation_id;
end;
$$;

revoke execute on function public.ensure_direct_conversation(uuid)
  from public, anon;
grant execute on function public.ensure_direct_conversation(uuid)
  to authenticated;

comment on function public.ensure_direct_conversation(uuid) is
  'Authenticated participant RPC for safely reusing or creating an available-profile, blocked-user-aware one-to-one DM conversation.';

-- Verification:
-- select has_function_privilege('anon', 'public.ensure_direct_conversation(uuid)', 'execute') as anon_rpc_execute_denied;
-- select has_function_privilege('authenticated', 'public.ensure_direct_conversation(uuid)', 'execute') as authenticated_rpc_execute_allowed;
-- Rollback:
-- Reapply supabase/migrations/20260726183000_direct_conversation_pairs.sql function definition if this unapplied hardening migration must be backed out before release.
