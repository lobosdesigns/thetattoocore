create unique index if not exists notifications_message_recipient_type_unique
  on public.notifications (message_id, recipient_id, type)
  where message_id is not null;

create or replace function public.insert_notifications_with_native_delivery(
  p_notifications jsonb,
  p_enqueue_native boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer := 0;
  queued_count integer := 0;
begin
  if jsonb_typeof(p_notifications) <> 'array'
    or jsonb_array_length(p_notifications) < 1
    or jsonb_array_length(p_notifications) > 100 then
    raise exception 'Notification batch must contain between 1 and 100 rows.';
  end if;

  with inserted as (
    insert into public.notifications (
      actor_id,
      body,
      href,
      message_id,
      recipient_id,
      subject_id,
      subject_type,
      title,
      type
    )
    select
      nullif(item ->> 'actor_id', '')::uuid,
      nullif(item ->> 'body', ''),
      nullif(item ->> 'href', ''),
      nullif(item ->> 'message_id', '')::uuid,
      (item ->> 'recipient_id')::uuid,
      nullif(item ->> 'subject_id', '')::uuid,
      item ->> 'subject_type',
      item ->> 'title',
      item ->> 'type'
    from jsonb_array_elements(p_notifications) as batch(item)
    on conflict do nothing
    returning id, message_id, recipient_id, type
  ),
  queued as (
    insert into public.native_push_delivery_jobs (
      device_id,
      notification_id
    )
    select devices.id, inserted.id
    from inserted
    join public.native_push_devices as devices
      on devices.profile_id = inserted.recipient_id
      and devices.is_active
    where p_enqueue_native
      and inserted.type = 'message'
      and inserted.message_id is not null
    on conflict (notification_id, device_id) do nothing
    returning 1
  ),
  counts as (
    select
      (select count(*) from inserted)::integer as inserted_count,
      (select count(*) from queued)::integer as queued_count
  )
  select counts.inserted_count, counts.queued_count
  into inserted_count, queued_count
  from counts;

  return jsonb_build_object(
    'inserted_count', inserted_count,
    'queued_count', queued_count
  );
end;
$$;

revoke execute on function public.insert_notifications_with_native_delivery(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.insert_notifications_with_native_delivery(jsonb, boolean)
  to service_role;

comment on index public.notifications_message_recipient_type_unique is
  'Deduplicates retried message notification processing for the same recipient and source message.';
comment on function public.insert_notifications_with_native_delivery(jsonb, boolean) is
  'Atomically inserts in-app alerts and optional DM-only native delivery jobs for the trusted server; duplicate message notifications are ignored.';

-- Verification:
-- select indexdef from pg_indexes where schemaname = 'public' and indexname = 'notifications_message_recipient_type_unique';
-- select has_function_privilege('authenticated', 'public.insert_notifications_with_native_delivery(jsonb, boolean)', 'execute') as authenticated_insert_notifications_execute_denied;
-- select has_function_privilege('service_role', 'public.insert_notifications_with_native_delivery(jsonb, boolean)', 'execute') as service_insert_notifications_execute_allowed;
-- Rollback:
-- drop index if exists public.notifications_message_recipient_type_unique;
-- Reapply the function definition from supabase/migrations/20260722225151_native_push_delivery_outbox.sql if this unapplied dedupe migration must be backed out before release.
