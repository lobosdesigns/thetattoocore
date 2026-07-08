-- Publish direct-message inserts to Supabase Realtime.

alter publication supabase_realtime add table public.messages;
