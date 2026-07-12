import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ytznkgcslezijkehwjsj.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_8hTy3UyxP93glZU1LN8YiQ_zs-5m2St";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
