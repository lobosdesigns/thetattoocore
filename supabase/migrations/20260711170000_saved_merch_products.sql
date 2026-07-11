alter table public.saved_items
  drop constraint if exists saved_items_subject_type_check;

alter table public.saved_items
  add constraint saved_items_subject_type_check check (
    subject_type in (
      'feed_post',
      'thread_post',
      'marketplace_listing',
      'gig',
      'profile',
      'merch_product'
    )
  );
