alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow_request',
    'follow_accepted',
    'message',
    'feed_like',
    'feed_comment',
    'thread_like',
    'thread_comment',
    'new_follow',
    'verification_approved',
    'verification_rejected',
    'merch_fulfilled',
    'merch_refunded'
  ));
