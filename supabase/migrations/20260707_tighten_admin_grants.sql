-- Tighten Data API privileges for admin foundation tables.

revoke all on public.content_reports from anon, authenticated;
revoke all on public.moderation_actions from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
revoke all on public.mail_settings from anon, authenticated;

grant select, insert, update on public.content_reports to authenticated;
grant select, insert on public.moderation_actions to authenticated;
grant select, insert on public.admin_audit_logs to authenticated;
grant select, update on public.mail_settings to authenticated;
