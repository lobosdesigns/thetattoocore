create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_id);

create index if not exists content_reports_reporter_idx
  on public.content_reports (reporter_id);

create index if not exists content_reports_assigned_to_idx
  on public.content_reports (assigned_to);

create index if not exists content_reports_resolved_by_idx
  on public.content_reports (resolved_by);

create index if not exists mail_settings_updated_by_idx
  on public.mail_settings (updated_by);

create index if not exists marketplace_listings_seller_created_idx
  on public.marketplace_listings (seller_id, created_at desc);

create index if not exists marketplace_media_listing_idx
  on public.marketplace_media (listing_id, sort_order);

create index if not exists moderation_actions_report_idx
  on public.moderation_actions (report_id);

create index if not exists post_comments_author_idx
  on public.post_comments (author_id);

create index if not exists post_likes_user_idx
  on public.post_likes (user_id);
