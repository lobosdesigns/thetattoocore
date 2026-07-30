-- Let moderator-capable actions record their own audit rows while keeping
-- audit history read-only and limiting SMTP configuration changes to owners.

drop policy if exists "Admins can create audit logs" on public.admin_audit_logs;
drop policy if exists "Staff can create audit logs" on public.admin_audit_logs;

create policy "Staff can create audit logs"
  on public.admin_audit_logs for insert
  to authenticated
  with check (
    (
      private.current_user_can_admin()
      or (
        private.current_user_can_moderate()
        and event_type in (
          'help_comment_pending_review',
          'help_comment_visible',
          'help_comment_hidden',
          'help_comment_removed',
          'license_approved',
          'license_rejected',
          'account_deletion_reviewing',
          'account_deletion_rejected',
          'account_deletion_cancelled'
        )
      )
    )
    and actor_id = (select auth.uid())
  );

drop policy if exists "Admins can update mail settings" on public.mail_settings;
drop policy if exists "Owners can update mail settings" on public.mail_settings;

create policy "Owners can update mail settings"
  on public.mail_settings for update
  to authenticated
  using (private.current_user_is_owner())
  with check (private.current_user_is_owner());
