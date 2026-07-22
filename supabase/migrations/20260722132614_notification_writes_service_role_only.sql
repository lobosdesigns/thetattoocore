drop policy if exists "Users can create actor notifications"
  on public.notifications;

revoke all privileges on table public.notifications from authenticated;
grant select, update, delete on table public.notifications to authenticated;

grant select, insert, update, delete on table public.notifications to service_role;
