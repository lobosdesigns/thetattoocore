drop policy if exists "Profile avatars are publicly readable"
  on storage.objects;
drop policy if exists "Merch media is publicly readable"
  on storage.objects;

revoke all on function public.decrement_merch_inventory_for_order(uuid)
  from public, anon, authenticated;
grant execute on function public.decrement_merch_inventory_for_order(uuid)
  to service_role;

revoke all on function public.delete_post_comment_for_current_user(uuid)
  from public, anon;
grant execute on function public.delete_post_comment_for_current_user(uuid)
  to authenticated;

revoke all on function public.delete_thread_comment_for_current_user(uuid)
  from public, anon;
grant execute on function public.delete_thread_comment_for_current_user(uuid)
  to authenticated;
