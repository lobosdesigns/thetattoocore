revoke all privileges on table public.notifications from anon;

grant select, insert, update, delete on table public.notifications to service_role;
