import assert from "node:assert/strict";
import { selectMessageConversation } from "../src/lib/message-conversation-selection.ts";

const conversations = [
  {
    id: "newest-conversation",
    otherProfile: { username: "newest_member" },
  },
  {
    id: "requested-conversation",
    otherProfile: { username: "requested_member" },
  },
];

assert.equal(
  selectMessageConversation({
    conversations,
    prefillUsername: "",
    requestedConversationId: "",
  }),
  null,
  "a bare inbox must not select or mark its newest conversation read",
);
assert.equal(
  selectMessageConversation({
    conversations,
    prefillUsername: "",
    requestedConversationId: "requested-conversation",
  })?.id,
  "requested-conversation",
);
assert.equal(
  selectMessageConversation({
    conversations,
    prefillUsername: "newest_member",
    requestedConversationId: "",
  })?.id,
  "newest-conversation",
);
assert.equal(
  selectMessageConversation({
    conversations,
    prefillUsername: "requested_member",
    requestedConversationId: "missing-conversation",
  }),
  null,
  "an explicit conversation id must not fall back to a profile prefill",
);

console.log("PASS DM selection requires an explicit thread open");
