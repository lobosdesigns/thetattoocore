"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, LoaderCircle, Trash2 } from "lucide-react";
import { MediaLightbox } from "@/app/media-lightbox";
import { ProfileAvatar } from "@/app/profile-avatar";
import { createClient } from "@/lib/supabase/client";
import { deleteUnreadMessage } from "./actions";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

const nearBottomThresholdPx = 80;

export type ThreadMessage = {
  attachments?: {
    id: string;
    media_type: "image";
    mime_type: string;
    original_filename: string | null;
    signedUrl: string | null;
  }[];
  id: string;
  body: string;
  conversation_id: string;
  sender_id: string;
  created_at: string;
};

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function ProfileAvatarLink({ profile }: { profile?: Profile }) {
  if (!profile?.username) {
    return <ProfileAvatar profile={profile} size="sm" />;
  }

  return (
    <Link
      aria-label={`Open ${profile.display_name || profile.username} profile`}
      className="shrink-0"
      href={`/u/${profile.username}`}
    >
      <ProfileAvatar profile={profile} size="sm" />
    </Link>
  );
}

function compareMessages(left: ThreadMessage, right: ThreadMessage) {
  const createdAtDifference =
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

  return createdAtDifference || left.id.localeCompare(right.id);
}

function mergeMessages(
  currentMessages: ThreadMessage[],
  incomingMessages: ThreadMessage[],
) {
  const messageById = new Map(
    currentMessages.map((message) => [message.id, message]),
  );

  for (const message of incomingMessages) {
    messageById.set(message.id, message);
  }

  return [...messageById.values()].sort(compareMessages);
}

export function MessageThread({
  conversationId,
  currentUserId,
  hasEarlierMessages,
  initialMessages,
  otherLastReadAt,
  profiles,
}: {
  conversationId: string;
  currentUserId: string;
  hasEarlierMessages: boolean;
  initialMessages: ThreadMessage[];
  otherLastReadAt: string | null;
  profiles: Profile[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const previousLatestMessageIdRef = useRef<string | null>(null);
  const previousOldestMessageIdRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef(0);
  const previousScrollHeightRef = useRef(0);
  const autoFollowLatestRef = useRef(true);
  const [deletedMessageIds, setDeletedMessageIds] = useState<string[]>([]);
  const [historyMessage, setHistoryMessage] = useState("");
  const [historyMessages, setHistoryMessages] = useState<ThreadMessage[]>([]);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [moreHistoryAvailable, setMoreHistoryAvailable] =
    useState(hasEarlierMessages);
  const router = useRouter();
  const messages = useMemo(() => {
    const deletedIds = new Set(deletedMessageIds);

    return mergeMessages(historyMessages, initialMessages).filter(
      (message) => !deletedIds.has(message.id),
    );
  }, [deletedMessageIds, historyMessages, initialMessages]);
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const updateAutoFollowLatest = useCallback(() => {
    const container = scrollRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    autoFollowLatestRef.current =
      distanceFromBottom <= nearBottomThresholdPx;
  }, []);

  useLayoutEffect(() => {
    const container = scrollRef.current;

    if (!container) return;

    const oldestMessageId = messages[0]?.id ?? null;
    const latestMessage = messages.at(-1);
    const latestMessageId = latestMessage?.id ?? null;
    const conversationChanged =
      previousConversationIdRef.current !== conversationId;
    const loadedEarlierMessages =
      !conversationChanged &&
      messages.length > previousMessageCountRef.current &&
      latestMessageId === previousLatestMessageIdRef.current &&
      oldestMessageId !== previousOldestMessageIdRef.current;

    if (conversationChanged || previousConversationIdRef.current === null) {
      container.scrollTop = container.scrollHeight;
    } else if (loadedEarlierMessages) {
      const addedHeight =
        container.scrollHeight - previousScrollHeightRef.current;
      container.scrollTop += Math.max(0, addedHeight);
    } else if (
      latestMessageId !== previousLatestMessageIdRef.current &&
      (autoFollowLatestRef.current ||
        latestMessage?.sender_id === currentUserId)
    ) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }

    previousConversationIdRef.current = conversationId;
    previousLatestMessageIdRef.current = latestMessageId;
    previousOldestMessageIdRef.current = oldestMessageId;
    previousMessageCountRef.current = messages.length;
    previousScrollHeightRef.current = container.scrollHeight;
    updateAutoFollowLatest();
  }, [conversationId, currentUserId, messages, updateAutoFollowLatest]);

  useEffect(() => {
    const supabase = createClient();
    let attachmentCatchupTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshThread = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        router.refresh();
      }, 350);
    };
    const refreshThreadWithAttachmentCatchup = () => {
      refreshThread();
      if (attachmentCatchupTimer) clearTimeout(attachmentCatchupTimer);
      attachmentCatchupTimer = setTimeout(refreshThread, 1200);
    };
    const channel = supabase
      .channel(`dm-thread:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `conversation_id=eq.${conversationId}`,
          schema: "public",
          table: "messages",
        },
        refreshThreadWithAttachmentCatchup,
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          filter: `conversation_id=eq.${conversationId}`,
          schema: "public",
          table: "messages",
        },
        (event) => {
          const deletedMessageId =
            typeof event.old?.id === "string" ? event.old.id : null;

          if (deletedMessageId) {
            setDeletedMessageIds((currentIds) =>
              currentIds.includes(deletedMessageId)
                ? currentIds
                : [...currentIds, deletedMessageId],
            );
          }
          refreshThread();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `conversation_id=eq.${conversationId}`,
          schema: "public",
          table: "conversation_members",
        },
        refreshThread,
      )
      .subscribe();

    return () => {
      if (attachmentCatchupTimer) clearTimeout(attachmentCatchupTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  async function loadEarlierMessages() {
    const oldestMessage = messages[0];

    if (!oldestMessage || loadingEarlier) return;

    setLoadingEarlier(true);
    setHistoryMessage("");

    try {
      const query = new URLSearchParams({
        beforeCreatedAt: oldestMessage.created_at,
        beforeId: oldestMessage.id,
        conversationId,
      });
      const response = await fetch(`/api/messages/history?${query}`, {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Earlier messages could not be loaded.");

      const payload = (await response.json()) as {
        hasMore?: unknown;
        messages?: ThreadMessage[];
      };
      const earlierMessages = Array.isArray(payload.messages)
        ? payload.messages
        : [];

      setHistoryMessages((currentMessages) =>
        mergeMessages(currentMessages, earlierMessages),
      );
      setMoreHistoryAvailable(payload.hasMore === true);

      if (payload.hasMore !== true) {
        setHistoryMessage("Start of conversation reached.");
      }
    } catch {
      setHistoryMessage("Earlier messages could not be loaded. Try again.");
    } finally {
      setLoadingEarlier(false);
    }
  }

  return (
    <div
      className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-5"
      onScroll={updateAutoFollowLatest}
      ref={scrollRef}
    >
      {moreHistoryAvailable ? (
        <div className="flex flex-col items-center gap-2 pb-1">
          <button
            className="ttc-surface flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-bold disabled:opacity-60"
            disabled={loadingEarlier}
            onClick={loadEarlierMessages}
            type="button"
          >
            {loadingEarlier ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            {loadingEarlier ? "Loading earlier messages" : "Load 100 earlier messages"}
          </button>
          {historyMessage ? (
            <p className="text-xs text-[var(--muted-strong)]">{historyMessage}</p>
          ) : null}
        </div>
      ) : null}
      {!moreHistoryAvailable && historyMessage ? (
        <p className="text-center text-xs text-[var(--muted-strong)]">
          {historyMessage}
        </p>
      ) : null}
      {messages.map((message) => {
        const mine = message.sender_id === currentUserId;
        const sender = profileById.get(message.sender_id);
        const hasBeenRead =
          mine &&
          otherLastReadAt &&
          new Date(otherLastReadAt).getTime() >=
            new Date(message.created_at).getTime();
        const canDeleteUnread = mine && !hasBeenRead;

        return (
          <div className="min-w-0" key={message.id}>
            <div
              className={`min-w-0 flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
            >
              {!mine ? <ProfileAvatarLink profile={sender} /> : null}
              <div
                className={`max-w-[82%] overflow-hidden rounded-md px-4 py-3 sm:max-w-[78%] ${
                  mine
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "ttc-surface border"
                }`}
              >
                {message.attachments?.length ? (
                  <div className="mb-3 grid gap-2">
                    {message.attachments.map((attachment) =>
                      attachment.signedUrl ? (
                        <MediaLightbox
                          alt={attachment.original_filename ?? "DM attachment"}
                          key={attachment.id}
                          mediaType="image"
                          src={attachment.signedUrl}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={attachment.original_filename ?? "DM attachment"}
                            className="max-h-80 w-full rounded-md object-cover"
                            src={attachment.signedUrl}
                          />
                        </MediaLightbox>
                      ) : (
                        <div
                          className={`rounded-md border px-3 py-2 text-xs ${
                            mine
                              ? "border-[color-mix(in_srgb,var(--background)_20%,transparent)] bg-[color-mix(in_srgb,var(--background)_10%,transparent)] text-[color-mix(in_srgb,var(--background)_82%,transparent)]"
                              : "ttc-surface"
                          }`}
                          key={attachment.id}
                        >
                          Photo unavailable
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
                {message.body ? (
                  <p className="break-words whitespace-pre-wrap text-sm leading-6">
                    {message.body}
                  </p>
                ) : null}
                <p
                  className={`mt-2 text-[11px] ${
                    mine
                      ? "text-[color-mix(in_srgb,var(--background)_72%,transparent)]"
                      : "text-[var(--muted-strong)]"
                  }`}
                >
                  {mine ? "You" : sender?.display_name ?? "TattooCore member"} -{" "}
                  {timeAgo(message.created_at)}
                </p>
              </div>
              {mine ? <ProfileAvatarLink profile={sender} /> : null}
            </div>
            {mine ? (
              <div className="mt-1 flex justify-end">
                <div className="flex max-w-[82%] items-center justify-end gap-2 pr-12 text-[11px] text-[var(--muted-strong)] sm:max-w-[78%]">
                  <span className="inline-flex items-center gap-1">
                    {hasBeenRead ? (
                      <>
                        <CheckCheck className="size-3.5 text-[var(--accent)]" />
                        Read
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        Delivered
                      </>
                    )}
                  </span>
                  {canDeleteUnread ? (
                    <form action={deleteUnreadMessage}>
                      <input
                        name="conversation_id"
                        type="hidden"
                        value={conversationId}
                      />
                      <input name="message_id" type="hidden" value={message.id} />
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_88%,transparent)] px-2 py-1 font-semibold text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--danger)_35%,var(--card-rim))] hover:text-[var(--danger)]"
                        title="Delete before the other member reads it"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
