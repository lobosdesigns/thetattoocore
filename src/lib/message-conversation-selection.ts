type MessageConversationCandidate = {
  id: string;
  otherProfile?: {
    username: string;
  };
};

export function selectMessageConversation<
  T extends MessageConversationCandidate,
>({
  conversations,
  prefillUsername,
  requestedConversationId,
}: {
  conversations: readonly T[];
  prefillUsername: string;
  requestedConversationId: string;
}) {
  if (requestedConversationId) {
    return (
      conversations.find(
        (conversation) => conversation.id === requestedConversationId,
      ) ?? null
    );
  }

  if (!prefillUsername) return null;

  return (
    conversations.find(
      (conversation) =>
        conversation.otherProfile?.username === prefillUsername,
    ) ?? null
  );
}
