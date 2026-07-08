revoke all on public.gigs from anon, authenticated;
revoke all on public.gig_media from anon, authenticated;

grant select on public.gigs to anon;
grant select, insert, update on public.gigs to authenticated;

grant select on public.gig_media to anon;
grant select, insert, update, delete on public.gig_media to authenticated;
