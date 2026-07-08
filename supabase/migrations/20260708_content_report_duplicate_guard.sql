create unique index if not exists content_reports_open_unique_idx
  on public.content_reports (reporter_id, subject_type, subject_id)
  where status in ('open', 'reviewing');
