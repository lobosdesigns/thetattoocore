grant select on table public.direct_conversation_pairs
  to authenticated;

comment on table public.direct_conversation_pairs is
  'One-to-one DM uniqueness registry. Authenticated members can read only their own pair through RLS; writes remain service-owned through ensure_direct_conversation.';

-- Verification:
-- select has_table_privilege('authenticated', 'public.direct_conversation_pairs', 'select') as authenticated_pair_select_allowed;
-- select has_table_privilege('authenticated', 'public.direct_conversation_pairs', 'insert') as authenticated_pair_insert_denied;
-- Rollback:
-- revoke select on table public.direct_conversation_pairs from authenticated;
