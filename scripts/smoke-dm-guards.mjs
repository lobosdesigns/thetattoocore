import { readFileSync } from "node:fs";

const appActions = readFileSync("src/app/actions.ts", "utf8");
const messageActions = readFileSync("src/app/messages/actions.ts", "utf8");
const messageLoading = readFileSync("src/app/messages/loading.tsx", "utf8");
const messagePage = readFileSync("src/app/messages/page.tsx", "utf8");
const messageHistoryApi = readFileSync("src/app/api/messages/history/route.ts", "utf8");
const messageStartForm = readFileSync("src/app/messages/message-start-form.tsx", "utf8");
const messageThread = readFileSync("src/app/messages/message-thread.tsx", "utf8");
const columnTabs = readFileSync("src/app/column-tabs.tsx", "utf8");
const columnSnapRail = readFileSync("src/app/column-snap-rail.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const messageNotificationMigration = readFileSync(
  "supabase/migrations/20260722142805_message_notification_linkage.sql",
  "utf8",
);
const notificationWriter = readFileSync("src/lib/notification-write.ts", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const qaChecklist = readFileSync("docs/REAL_DEVICE_QA_CHECKLIST.md", "utf8");

function appearsInOrder(source, snippets) {
  let cursor = 0;

  return snippets.every((snippet) => {
    const index = source.indexOf(snippet, cursor);
    if (index === -1) return false;

    cursor = index + snippet.length;
    return true;
  });
}

const checks = [
  {
    label: "DM navigation has an accessible layout-stable loading shell",
    ok:
      messageLoading.includes('aria-busy="true"') &&
      messageLoading.includes('aria-label="Loading messages"') &&
      messageLoading.includes('className="ttc-page h-[100dvh] overflow-hidden"') &&
      messageLoading.includes("lg:grid-cols-[320px_minmax(0,1fr)]") &&
      messageLoading.includes('className="sr-only" role="status"') &&
      messageLoading.includes("inboxPlaceholders.map") &&
      !messageLoading.toLowerCase().includes("supabase") &&
      !messageLoading.toLowerCase().includes("stripe") &&
      !messageLoading.toLowerCase().includes("firebase"),
  },
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
      messageActions.includes('console.error("DM photo upload failed.", uploadError)') &&
      messageActions.includes('"Message sent, but the photo could not upload."') &&
      messageActions.includes('console.error("DM photo attach failed.", attachmentError)') &&
      messageActions.includes('"Message sent, but the photo could not attach."') &&
      !messageActions.includes('uploadError.message || "Message sent, but photo upload failed."') &&
      !messageActions.includes('attachmentError.message || "Message sent, but photo could not attach."') &&
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
      messageActions.includes('console.error("Unread DM delete failed.", deleteError)') &&
      messageActions.includes('"Could not delete that unread DM. Please try again."') &&
      !messageActions.includes('deleteError.message || "Could not delete that unread DM."') &&
      messageActions.includes(".delete()"),
  },
  {
    label: "deleted unread DMs cascade their exact notification source",
    ok:
      (messageActions.match(/message_id: message\.id/g) ?? []).length >= 2 &&
      appActions.includes("export async function replyToStory") &&
      appActions.includes("message_id: message.id") &&
      notificationWriter.includes("message_id?: string | null") &&
      messageNotificationMigration.includes(
        "add column if not exists message_id uuid",
      ) &&
      messageNotificationMigration.includes(
        "references public.messages(id) on delete cascade",
      ) &&
      messageNotificationMigration.includes(
        "check (message_id is null or type = 'message')",
      ) &&
      messageNotificationMigration.includes("notifications_message_id_idx"),
  },
  {
    label: "DM create and send actions hide raw database errors",
    ok:
      messageActions.includes('console.error("DM conversation create failed.", conversationError)') &&
      messageActions.includes('"Could not start conversation. Please try again."') &&
      messageActions.includes('console.error("DM creator membership create failed.", creatorMemberError)') &&
      messageActions.includes('console.error("DM target membership create failed.", targetMemberError)') &&
      messageActions.includes('console.error("DM initial message create failed.", messageError)') &&
      messageActions.includes('console.error("DM message create failed.", error)') &&
      messageActions.includes('"Could not send message. Please try again."') &&
      messageActions.includes('console.error("DM delete lookup failed.", messageError)') &&
      !messageActions.includes('conversationError?.message || "Could not start conversation."') &&
      !messageActions.includes("creatorMemberError.message") &&
      !messageActions.includes("targetMemberError.message") &&
      !messageActions.includes('messageError?.message || "Could not send message."') &&
      !messageActions.includes('error?.message || "Could not send message."') &&
      !messageActions.includes('messageError?.message || "That message was not found."'),
  },
  {
    label: "DM inbox stays paginated and unavailable thread links recover",
    ok:
      messagePage.includes("const inboxPageSize = 25") &&
      messagePage.includes("const conversationLimit = inboxPage * inboxPageSize") &&
      messagePage.includes("const defaultConversationFetchLimit = conversationLimit + inboxPageSize") &&
      messagePage.includes("const conversationFetchLimit = activeInboxSearch ? 500 : defaultConversationFetchLimit") &&
      messagePage.includes(".limit(conversationFetchLimit)") &&
      messagePage.includes("const inbox = filteredInbox.slice(0, conversationLimit)") &&
      messagePage.includes("const hasMoreInbox =") &&
      messagePage.includes("const selectedConversationCandidates = hasSelectedConversationParam") &&
      messagePage.includes("? inboxBeforeSearch") &&
      messagePage.includes("Conversation was not found or is no longer available.") &&
      messagePage.includes("href={inboxHref({"),
  },
  {
    label: "DM profile links open existing threads with prior messages",
    ok:
      messagePage.includes("async function findSharedConversationMembership") &&
      messagePage.includes(".eq(\"username\", prefillUsername)") &&
      messagePage.includes("const targetConversationIds = new Set") &&
      messagePage.includes("targetConversationIds.has(membership.conversation_id)") &&
      messagePage.includes("const prefillConversation =") &&
      messagePage.includes("conversation.otherProfile?.username === prefillUsername") &&
      messagePage.includes("prefillConversation ?? inbox[0]") &&
      messagePage.includes("const hasOpenThreadView =") &&
      messagePage.includes("hasSelectedConversationParam || prefillConversation") &&
      messagePage.includes(".eq(\"conversation_id\", selectedConversation.id)") &&
      messagePage.includes("selectedConversationMessages") &&
      messagePage.includes("selectedMessagesWithAttachments") &&
      messageStartForm.includes('import Link from "next/link"') &&
      messageStartForm.includes('href={`/messages?to=${encodeURIComponent(profile.username)}`}') &&
      messageStartForm.includes('aria-current={active ? "true" : undefined}') &&
      !messageStartForm.includes("onClick={() => selectProfile(profile)}"),
  },
  {
    label: "DM threads can load older history without losing scroll position",
    ok:
      messagePage.includes(".limit(101)") &&
      messagePage.includes("selectedMessageRows.length > 100") &&
      messagePage.includes("selectedMessageRows.slice(0, 100).toReversed()") &&
      messagePage.includes("hasEarlierMessages={hasEarlierThreadMessages}") &&
      messagePage.includes("key={selectedConversation.id}") &&
      messageThread.includes("hasEarlierMessages: boolean") &&
      messageThread.includes("Load 100 earlier messages") &&
      messageThread.includes('fetch(`/api/messages/history?${query}`') &&
      messageThread.includes("mergeMessages(currentMessages, earlierMessages)") &&
      messageThread.includes("const loadedEarlierMessages =") &&
      messageThread.includes("container.scrollTop += Math.max(0, addedHeight)") &&
      messageHistoryApi.includes("supabase.auth.getClaims()") &&
      messageHistoryApi.includes('.from("conversation_members")') &&
      messageHistoryApi.includes('.eq("user_id", userId)') &&
      messageHistoryApi.includes(".limit(messagePageSize + 1)") &&
      messageHistoryApi.includes(".createSignedUrl(attachment.storage_path, 3600)") &&
      !messageHistoryApi.includes("console."),
  },
  {
    label: "incoming DMs preserve older reading position",
    ok:
      messageThread.includes("const nearBottomThresholdPx = 80") &&
      messageThread.includes("const autoFollowLatestRef = useRef(true)") &&
      messageThread.includes("const distanceFromBottom =") &&
      messageThread.includes("distanceFromBottom <= nearBottomThresholdPx") &&
      messageThread.includes("autoFollowLatestRef.current ||") &&
      messageThread.includes("latestMessage?.sender_id === currentUserId") &&
      messageThread.includes("onScroll={updateAutoFollowLatest}"),
  },
  {
    label: "DM start action reuses the newest shared thread deterministically",
    ok:
      messageActions.includes("async function findExistingConversation") &&
      messageActions.includes('.select("conversation_id")') &&
      messageActions.includes('.order("created_at", { ascending: false })') &&
      messageActions.includes("const targetConversationIds = new Set") &&
      messageActions.includes("targetConversationIds.has(membership.conversation_id)") &&
      !messageActions.includes(".limit(1)\n    .maybeSingle<{ conversation_id: string }>()"),
  },
  {
    label: "DM prefilled profile route fetches shared thread before inbox slicing",
    ok:
      appearsInOrder(messagePage, [
        "const { data: membershipRows } = await supabase",
        "const memberships = [...(membershipRows ?? [])];",
        "const prefillMembership = await findSharedConversationMembership",
        "memberships.unshift(prefillMembership);",
        "const conversationIds = memberships.map",
        "const inboxBeforeSearch = memberships",
        "const inbox = filteredInbox.slice(0, conversationLimit);",
        "const prefillConversation =",
        "const selectedMessages = selectedConversation",
        "selectedMessagesWithAttachments",
      ]) &&
      !messagePage.includes("const conversationIds = membershipRows"),
  },
  {
    label: "DM launch plan and real-device QA keep the remaining manual pass visible",
    ok:
      productPlan.includes("DMs need a focused test pass") &&
      productPlan.includes("Real send/receive testing still needs logged-in test sessions") &&
      qaChecklist.includes("Send and receive a text message between two known test accounts") &&
      qaChecklist.includes("Open a DM notification and confirm it routes to the correct thread without reload loops") &&
      qaChecklist.includes("Repo-safe two-user DM evidence should record only tester aliases") &&
      qaChecklist.includes("message direction, read/reply result, attachment result, notification-route result") &&
      qaChecklist.includes("Keep email addresses, passwords, one-time codes, private message bodies") &&
      qaChecklist.includes("private release handoff only"),
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
    label: "product plan keeps DM out of the main column order",
    ok:
      productPlan.includes("Column order for launch planning is 4U, Gossip, Stuff, Gigs, and Merch.") &&
      productPlan.includes("DM is intentionally not a main swipe column") &&
      !productPlan.includes("Merch, then DM"),
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
  {
    label: "DM start form searches accepted follows and active DM profiles",
    ok:
      messagePage.includes("MessageStartForm") &&
      messagePage.includes('.from("follows")') &&
      messagePage.includes('.eq("status", "accepted")') &&
      messagePage.includes("connectedProfileIds") &&
      messagePage.includes("profileFetchIds") &&
      messagePage.includes("[...connectedProfileIds, ...profileIds]") &&
      messagePage.includes("connectedProfilesForPicker") &&
      messageStartForm.includes("Followers, following, and active DMs") &&
      messageStartForm.includes("Search followers, following, or username") &&
      messageStartForm.includes("Search followers, following, active DMs, or type an exact username.") &&
      messageStartForm.includes("send if the member is not listed yet") &&
      messageStartForm.includes("function matchScore") &&
      messageStartForm.includes("if (username === term) score += 100") &&
      messageStartForm.includes("else if (username.startsWith(term)) score += 70") &&
      messageStartForm.includes("const scoreDiff = matchScore(b, terms) - matchScore(a, terms)") &&
      messageStartForm.includes("function canSendToTarget") &&
      messageStartForm.includes("disabled={!canSend}") &&
      messageStartForm.includes('name="username"') &&
      messageStartForm.includes("type=\"hidden\"") &&
      messageStartForm.includes("setSelectedUsername") &&
      messageStartForm.includes("Ready to message @") &&
      messageStartForm.includes("Ready to try exact username @") &&
      messageStartForm.includes("profile.display_name") &&
      messageStartForm.includes("profile.city") &&
      messageStartForm.includes("profile.region") &&
      productPlan.includes("DM compose now uses a connected-people picker"),
  },
  {
    label: "DM inbox search filters threads and preserves load-more state",
    ok:
      messagePage.includes("function inboxSearchTerm") &&
      messagePage.includes("function conversationSearchText") &&
      messagePage.includes("const activeInboxSearch = inboxSearchTerm(params.q)") &&
      messagePage.includes("const conversationFetchLimit = activeInboxSearch ? 500") &&
      messagePage.includes("Search DM threads") &&
      messagePage.includes("Find a thread by user, city, or message") &&
      messagePage.includes("Search DMs") &&
      messagePage.includes("query: activeInboxSearch") &&
      messagePage.includes("No DM threads matched that search") &&
      productPlan.includes("DM inbox thread search now filters existing conversations"),
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
