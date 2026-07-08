drop policy if exists "Users can read own gigs" on public.gigs;
create policy "Users can read own gigs"
  on public.gigs for select
  to authenticated
  using ((select auth.uid()) = poster_id);
