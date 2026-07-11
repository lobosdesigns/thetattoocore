"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { MediaLightbox } from "@/app/media-lightbox";
import { ProfileAvatar } from "@/app/profile-avatar";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

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

export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
  profiles,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
  profiles: Profile[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [initialMessages.length]);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshThread = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        router.refresh();
      }, 350);
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
        refreshThread,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_attachments",
        },
        refreshThread,
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  return (
    <div className="min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-5">
      {initialMessages.map((message) => {
        const mine = message.sender_id === currentUserId;
        const sender = profileById.get(message.sender_id);

        return (
          <div
            className={`min-w-0 flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
            key={message.id}
          >
            {!mine ? <ProfileAvatar profile={sender} size="sm" /> : null}
            <div
              className={`max-w-[82%] overflow-hidden rounded-md px-4 py-3 sm:max-w-[78%] ${
                mine
                  ? "bg-[#171412] text-white"
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
                            ? "border-white/20 bg-white/10 text-white/80"
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
                  mine ? "text-white/70" : "text-[#766d62]"
                }`}
              >
                {mine ? "You" : sender?.display_name ?? "TattooCore member"} -{" "}
                {timeAgo(message.created_at)}
              </p>
            </div>
            {mine ? <ProfileAvatar profile={sender} size="sm" /> : null}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
