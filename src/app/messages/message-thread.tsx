"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string;
};

export type ThreadMessage = {
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
  const [messages, setMessages] = useState(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `conversation_id=eq.${conversationId}`,
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const incoming = payload.new as ThreadMessage;

          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) {
              return current;
            }

            return [...current, incoming].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
      {messages.map((message) => {
        const mine = message.sender_id === currentUserId;
        const sender = profileById.get(message.sender_id);

        return (
          <div
            className={`flex ${mine ? "justify-end" : "justify-start"}`}
            key={message.id}
          >
            <div
              className={`max-w-[78%] rounded-md px-4 py-3 ${
                mine
                  ? "bg-[#171412] text-white"
                  : "border border-[#d8d1c6] bg-white text-[#171412]"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-6">
                {message.body}
              </p>
              <p
                className={`mt-2 text-[11px] ${
                  mine ? "text-white/70" : "text-[#766d62]"
                }`}
              >
                {mine ? "You" : sender?.display_name ?? "TattooCore member"} -{" "}
                {timeAgo(message.created_at)}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
