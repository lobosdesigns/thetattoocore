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
    'merch_paid',
    'merch_fulfilled',
    'merch_refunded',
    'merch_payment_failed',
    'merch_cancelled',
    'ad_paid',
    'ad_payment_failed',
    'ad_refunded',
    'booking_request',
    'booking_accepted',
    'booking_declined',
    'booking_cancelled',
    'booking_deposit_paid'
  ));
