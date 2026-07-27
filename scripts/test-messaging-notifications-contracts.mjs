import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const source = {
  dmActions: read("src/app/messages/actions.ts"),
  sharedActions: read("src/app/actions.ts"),
  migration: read(
    "supabase/migrations/20260726183000_direct_conversation_pairs.sql",
  ),
  availabilityMigration: read(
    "supabase/migrations/20260726194500_harden_direct_conversation_availability.sql",
  ),
  dedupeMigration: read(
    "supabase/migrations/20260726200000_dedupe_message_notifications.sql",
  ),
  readStateMigration: read(
    "supabase/migrations/20260726201000_conversation_member_read_state_policy.sql",
  ),
  pairGrantMigration: read(
    "supabase/migrations/20260726202000_direct_pair_member_select_grant.sql",
  ),
  notificationWriter: read("src/lib/notification-write.ts"),
  notificationsPage: read("src/app/notifications/page.tsx"),
  nativeDeviceRoute: read("src/app/api/push/devices/route.ts"),
  nativeTestRoute: read("src/app/api/push/devices/test/route.ts"),
  pushSubscriptionRoute: read("src/app/api/push/subscriptions/route.ts"),
  senderCore: read("src/lib/native-push/sender-core.ts"),
};

const nativeMessageBuilder = source.senderCore.slice(
  source.senderCore.indexOf("export function buildNativeMessage"),
  source.senderCore.indexOf("export function classifyFcmResponse"),
);
assert.match(
  source.migration,
  /create table if not exists public\.direct_conversation_pairs/,
  "direct conversation pair registry table is created",
);
assert.match(
  source.migration,
  /primary key \(profile_low_id, profile_high_id\)/,
  "direct conversation pairs are unique per ordered profile pair",
);
assert.match(
  source.migration,
  /unique \(conversation_id\)/,
  "a direct conversation can belong to only one direct pair",
);
assert.match(
  source.migration,
  /revoke all on table public\.direct_conversation_pairs\s+from public, anon, authenticated;/,
  "direct pair table is not broadly readable or writable",
);
assert.match(
  source.migration,
  /create or replace function public\.ensure_direct_conversation/,
  "single RPC owns direct conversation creation",
);
assert.match(
  source.migration,
  /security definer/,
  "direct conversation RPC can perform the complete transaction server-side",
);
assert.match(
  source.migration,
  /caller_id uuid := \(select auth\.uid\(\)\)/,
  "direct conversation RPC is bound to the authenticated caller",
);
assert.match(
  source.migration,
  /p_target_id is null or p_target_id = caller_id/,
  "direct conversation RPC rejects malformed and self targets",
);
assert.match(
  source.migration,
  /from public\.user_blocks/,
  "direct conversation RPC blocks blocked relationships",
);
assert.match(
  source.migration,
  /order by conversations\.created_at desc, conversations\.id desc/,
  "direct conversation RPC adopts the newest existing shared conversation",
);
assert.match(
  source.migration,
  /on conflict \(profile_low_id, profile_high_id\) do nothing/,
  "direct conversation RPC serializes duplicate creation attempts",
);
assert.match(
  source.migration,
  /delete from public\.conversations/,
  "direct conversation RPC cleans up only its losing race conversation",
);
assert.match(
  source.migration,
  /grant execute on function public\.ensure_direct_conversation\(uuid\)\s+to authenticated;/,
  "only authenticated callers can execute direct conversation RPC",
);
assert.match(
  source.availabilityMigration,
  /suspended_at is null[\s\S]*banned_at is null/,
  "direct conversation RPC rejects unavailable caller and target profiles",
);
assert.match(
  source.availabilityMigration,
  /lower\(username\) not in [\s\S]*ttc_reviewer/,
  "direct conversation RPC rejects internal reviewer/test targets",
);
assert.match(
  source.pairGrantMigration,
  /grant select on table public\.direct_conversation_pairs\s+to authenticated;/,
  "direct pair members can use the authenticated select policy",
);
assert.match(
  source.readStateMigration,
  /grant update \(last_read_at\) on table public\.conversation_members\s+to authenticated;/,
  "participants can update only the read-state column",
);
assert.match(
  source.readStateMigration,
  /create policy "Users can update own conversation read state"/,
  "participants can mark only their own membership read",
);
assert.match(
  source.dedupeMigration,
  /notifications_message_recipient_type_unique/,
  "message notifications are deduped by source message and recipient",
);
assert.match(
  source.dedupeMigration,
  /on conflict do nothing/,
  "duplicate message notification processing is ignored safely",
);

for (const [label, actionSource] of [
  ["DM start action", source.dmActions],
  ["shared story/content action", source.sharedActions],
]) {
  assert.match(
    actionSource,
    /\.rpc\("ensure_direct_conversation"/,
    `${label} uses the database direct conversation RPC`,
  );
  assert.doesNotMatch(
    actionSource,
    /\.from\("conversations"\)\s*[\s\S]*?\.insert\(\{ created_by:/,
    `${label} does not hand-roll direct conversation creation`,
  );
}

assert.match(
  source.notificationWriter,
  /import "server-only"/,
  "notification writes stay behind a server-only helper",
);
assert.match(
  source.notificationWriter,
  /TTC_NATIVE_PUSH_DELIVERY_ENABLED === "true"/,
  "native delivery remains disabled unless the explicit delivery flag is enabled",
);
assert.match(
  source.notificationsPage,
  /\.eq\("recipient_id", claims\.sub\)/,
  "notification list fetches only the current user's notifications",
);
assert.doesNotMatch(
  source.notificationsPage,
  /profiles:profiles![^(]*\([^)]*email/i,
  "notification actor hydration excludes protected email fields",
);

for (const [label, routeSource] of [
  ["native device route", source.nativeDeviceRoute],
  ["native test route", source.nativeTestRoute],
  ["web push subscription route", source.pushSubscriptionRoute],
]) {
  assert.match(
    routeSource,
    /supabase\.auth\.getClaims\(\)/,
    `${label} requires an authenticated user`,
  );
  assert.doesNotMatch(
    routeSource,
    /console\./,
    `${label} avoids logging token or payload data`,
  );
}

assert.match(
  source.senderCore,
  /data: \{\s*notificationId,\s*type,\s*url,\s*\}/,
  "native push data payload is limited to routing metadata",
);
assert.doesNotMatch(
  nativeMessageBuilder,
  /email|cookie|tokenHash|device_token/i,
  "native push payload builder does not include protected identifiers",
);

console.log("PASS messaging, notifications, and push contracts");
