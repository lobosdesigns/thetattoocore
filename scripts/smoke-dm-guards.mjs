import { readFileSync } from "node:fs";

const messageActions = readFileSync("src/app/messages/actions.ts", "utf8");
const messagePage = readFileSync("src/app/messages/page.tsx", "utf8");
const messageThread = readFileSync("src/app/messages/message-thread.tsx", "utf8");
const columnTabs = readFileSync("src/app/column-tabs.tsx", "utf8");
const columnSnapRail = readFileSync("src/app/column-snap-rail.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const qaChecklist = readFileSync("docs/REAL_DEVICE_QA_CHECKLIST.md", "utf8");

const checks = [
  {
    label: "DM send requires membership and blocks blocked profiles",
    ok:
      messageActions.includes("export async function sendMessage") &&
      messageActions.includes('.from("conversation_members")') &&
      messageActions.includes(".eq(\"conversation_id\", conversationId)") &&
      messageActions.includes(".eq(\"user_id\", userId)") &&
      messageActions.includes("Choose one of your conversations first.") &&
      messageActions.includes("blockRelationshipExists(supabase, userId, member.user_id)") &&
      messageActions.includes("You cannot message a blocked profile."),
  },
  {
    label: "DM attachments stay image-only and use signed display URLs",
    ok:
      messageActions.includes('const MESSAGE_MEDIA_BUCKET = "message-media"') &&
      messageActions.includes("metadata.mediaType !== \"image\"") &&
      messageActions.includes("DM attachments support images right now.") &&
      messageActions.includes('.from("message_attachments")') &&
      messageActions.includes('media_type: "image"') &&
      messagePage.includes(".createSignedUrl(attachment.storage_path, 3600)") &&
      messageThread.includes("<MediaLightbox") &&
      messageThread.includes('mediaType="image"') &&
      messageThread.includes("Photo unavailable"),
  },
  {
    label: "DM thread avoids read-refresh loops and catches attachment inserts",
    ok:
      messagePage.includes("const shouldMarkThreadRead =") &&
      messagePage.includes("selectedUnreadNotificationIds.length > 0") &&
      messagePage.includes("latestIncomingAt > myLastReadAt") &&
      messagePage.includes("if (shouldMarkThreadRead)") &&
      messageThread.includes("let attachmentCatchupTimer") &&
      messageThread.includes("let refreshTimer") &&
      messageThread.includes("refreshThreadWithAttachmentCatchup") &&
      messageThread.includes("setTimeout(refreshThread, 1200)") &&
      messageThread.includes('table: "messages"') &&
      messageThread.includes('table: "conversation_members"'),
  },
  {
    label: "DM read receipts and unread delete controls are guarded",
    ok:
      messageThread.includes("const hasBeenRead =") &&
      messageThread.includes("otherLastReadAt") &&
      messageThread.includes("CheckCheck") &&
      messageThread.includes("Read") &&
      messageThread.includes("Check") &&
      messageThread.includes("Delivered") &&
      messageThread.includes("const canDeleteUnread = mine && !hasBeenRead") &&
      messageThread.includes("deleteUnreadMessage") &&
      messageActions.includes("That DM has already been read, so it cannot be deleted.") &&
      messageActions.includes("adminClient.storage.from(bucket).remove(paths)") &&
      messageActions.includes(".delete()"),
  },
  {
    label: "DM inbox stays paginated and unavailable thread links recover",
    ok:
      messagePage.includes("const inboxPageSize = 25") &&
      messagePage.includes("const conversationLimit = inboxPage * inboxPageSize") &&
      messagePage.includes("const conversationFetchLimit = conversationLimit + inboxPageSize") &&
      messagePage.includes(".limit(conversationFetchLimit)") &&
      messagePage.includes("const inbox = filteredInbox.slice(0, conversationLimit)") &&
      messagePage.includes("const hasMoreInbox =") &&
      messagePage.includes("Conversation was not found or is no longer available.") &&
      messagePage.includes('href={`/messages?inboxPage=${inboxPage + 1}`'),
  },
  {
    label: "DM launch plan and real-device QA keep the remaining manual pass visible",
    ok:
      productPlan.includes("DMs need a focused test pass") &&
      productPlan.includes("Real send/receive testing still needs logged-in test sessions") &&
      qaChecklist.includes("Send and receive a text message between two known test accounts") &&
      qaChecklist.includes("Open a DM notification and confirm it routes to the correct thread without reload loops"),
  },
  {
    label: "DM is dedicated to messenger routes instead of a main swipe column",
    ok:
      !columnTabs.includes("#messages") &&
      !columnSnapRail.includes('"messages"') &&
      !homePage.includes('id="messages"') &&
      homePage.includes('href="/messages"') &&
      productPlan.includes("removing the DM tab/rail column"),
  },
  {
    label: "DM thread keeps composer fixed and profile identity clickable",
    ok:
      messagePage.includes('className="ttc-page h-[100dvh] overflow-hidden"') &&
      messagePage.includes('className="shrink-0 space-y-3 border-t') &&
      messagePage.includes('href={`/u/${selectedConversation.otherProfile.username}`}') &&
      messageThread.includes("function ProfileAvatarLink") &&
      messageThread.includes("min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto") &&
      productPlan.includes("only already-sent messages scroll"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} DM guard smoke check(s) failed.`);
  process.exit(1);
}
