import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ImagePlus,
  Inbox,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MediaInput } from "@/app/media-input";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { ProfileAvatar } from "@/app/profile-avatar";
import { WordLimitedField } from "@/app/word-limited-field";
import { MessageThread } from "./message-thread";
import { sendMessage, startConversation } from "./actions";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "DM",
};

type Claims = {
  sub: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  account_type: string;
  city: string | null;
  region: string | null;
};

type Membership = {
  conversation_id: string;
  created_at: string;
  last_read_at: string | null;
};

type ConversationMember = {
  conversation_id: string;
  user_id: string;
};

type Message = {
  id: string;
  body: string;
  conversation_id: string;
  sender_id: string;
  created_at: string;
};

type MessageAttachment = {
  id: string;
  message_id: string;
  storage_bucket: string;
  storage_path: string;
  media_type: "image";
  mime_type: string;
  original_filename: string | null;
};

type MessageNotification = {
  href: string | null;
  subject_id: string | null;
};

const imageAccept = "image/jpeg,image/png,image/webp,image/gif";

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function profileLocation(profile?: Profile) {
  return [profile?.city, profile?.region].filter(Boolean).join(", ");
}

function notificationConversationId(notification: MessageNotification) {
  if (notification.subject_id) return notification.subject_id;
  if (!notification.href) return null;

  const [, query] = notification.href.split("?");
  if (!query) return null;

  return new URLSearchParams(query).get("c");
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return (
      <main className="min-h-screen bg-[#202020] px-4 py-8 text-[#171412]">
        <section className="ttc-card mx-auto max-w-xl rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-5">
          <h1 className="text-xl font-bold">DM</h1>
          <p className="mt-2 text-sm text-[#766d62]">
            Sign in to start conversations with artists, studios, and collectors.
          </p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
            href="/login"
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, account_type, city, region")
    .eq("id", claims.sub)
    .maybeSingle<Profile>();

  if (!currentProfile) {
    return (
      <main className="min-h-screen bg-[#202020] px-4 py-8 text-[#171412]">
        <section className="ttc-card mx-auto max-w-xl rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-5">
          <h1 className="text-xl font-bold">Finish profile</h1>
          <p className="mt-2 text-sm text-[#766d62]">
            Set up your profile before sending messages.
          </p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
            href="/account"
          >
            Profile
          </Link>
        </section>
      </main>
    );
  }

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, created_at, last_read_at")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: false })
    .returns<Membership[]>();
  const conversationIds =
    memberships?.map((membership) => membership.conversation_id) ?? [];

  const [
    { data: members },
    { data: messages },
    { data: unreadMessageNotifications },
  ] = await Promise.all([
    conversationIds.length
      ? supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", conversationIds)
          .returns<ConversationMember[]>()
      : Promise.resolve({ data: [] as ConversationMember[] }),
    conversationIds.length
      ? supabase
          .from("messages")
          .select("id, body, conversation_id, sender_id, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
          .returns<Message[]>()
      : Promise.resolve({ data: [] as Message[] }),
    conversationIds.length
      ? supabase
          .from("notifications")
          .select("subject_id, href")
          .eq("recipient_id", claims.sub)
          .eq("type", "message")
          .is("read_at", null)
          .returns<MessageNotification[]>()
      : Promise.resolve({ data: [] as MessageNotification[] }),
  ]);

  const profileIds = Array.from(
    new Set((members ?? []).map((member) => member.user_id)),
  );
  const { data: profiles } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, account_type, city, region")
        .in("id", profileIds)
        .returns<Profile[]>()
    : { data: [] as Profile[] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const messagesByConversation = new Map<string, Message[]>();

  for (const message of messages ?? []) {
    const list = messagesByConversation.get(message.conversation_id) ?? [];
    list.push(message);
    messagesByConversation.set(message.conversation_id, list);
  }

  const unreadCountByConversation = new Map<string, number>();

  for (const notification of unreadMessageNotifications ?? []) {
    const conversationId = notificationConversationId(notification);

    if (conversationId && conversationIds.includes(conversationId)) {
      unreadCountByConversation.set(
        conversationId,
        (unreadCountByConversation.get(conversationId) ?? 0) + 1,
      );
    }
  }

  let inbox = (memberships ?? [])
    .map((membership) => {
      const conversationMembers =
        members?.filter(
          (member) => member.conversation_id === membership.conversation_id,
        ) ?? [];
      const otherMember =
        conversationMembers.find((member) => member.user_id !== claims.sub) ??
        conversationMembers[0];
      const otherProfile = otherMember
        ? profileById.get(otherMember.user_id)
        : undefined;
      const conversationMessages =
        messagesByConversation.get(membership.conversation_id) ?? [];
      const latestMessage =
        conversationMessages[conversationMessages.length - 1] ?? null;

      return {
        id: membership.conversation_id,
        latestMessage,
        otherProfile,
        unreadCount:
          unreadCountByConversation.get(membership.conversation_id) ?? 0,
      };
    })
    .sort((a, b) => {
      const aTime = new Date(a.latestMessage?.created_at ?? 0).getTime();
      const bTime = new Date(b.latestMessage?.created_at ?? 0).getTime();

      return bTime - aTime;
    });

  const selectedConversation =
    inbox.find((conversation) => conversation.id === params.c) ?? inbox[0];

  if (selectedConversation?.unreadCount) {
    const readAt = new Date().toISOString();

    await Promise.all([
      supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("recipient_id", claims.sub)
        .eq("type", "message")
        .eq("subject_id", selectedConversation.id)
        .is("read_at", null),
      supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("recipient_id", claims.sub)
        .eq("type", "message")
        .eq("href", `/messages?c=${selectedConversation.id}`)
        .is("read_at", null),
      supabase
        .from("conversation_members")
        .update({ last_read_at: readAt })
        .eq("conversation_id", selectedConversation.id)
        .eq("user_id", claims.sub),
    ]);

    inbox = inbox.map((conversation) =>
      conversation.id === selectedConversation.id
        ? { ...conversation, unreadCount: 0 }
        : conversation,
    );
    selectedConversation.unreadCount = 0;
  }

  const selectedMessages = selectedConversation
    ? messagesByConversation.get(selectedConversation.id) ?? []
    : [];
  const selectedMessageIds = selectedMessages.map((message) => message.id);
  const { data: selectedAttachments } = selectedMessageIds.length
    ? await supabase
        .from("message_attachments")
        .select("id, message_id, storage_bucket, storage_path, media_type, mime_type, original_filename")
        .in("message_id", selectedMessageIds)
        .order("created_at", { ascending: true })
        .returns<MessageAttachment[]>()
    : { data: [] as MessageAttachment[] };
  const attachmentsWithUrls = await Promise.all(
    (selectedAttachments ?? []).map(async (attachment) => {
      const { data } = await supabase.storage
        .from(attachment.storage_bucket)
        .createSignedUrl(attachment.storage_path, 3600);

      return {
        ...attachment,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );
  const attachmentsByMessage = new Map<string, typeof attachmentsWithUrls>();

  for (const attachment of attachmentsWithUrls) {
    const list = attachmentsByMessage.get(attachment.message_id) ?? [];
    list.push(attachment);
    attachmentsByMessage.set(attachment.message_id, list);
  }
  const selectedMessagesWithAttachments = selectedMessages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id) ?? [],
  }));

  return (
    <main className="min-h-screen bg-[#202020] text-[#171412]">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-[#cfc8bd] bg-[#f2f1ee]">
          <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-4 backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Link
                aria-label="Back to feed"
                className="flex size-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold">DM</h1>
                <p className="truncate text-xs text-[#766d62]">
                  @{currentProfile.username}
                </p>
              </div>
              <ProfileAvatar profile={currentProfile} size="md" />
            </div>

            <form
              action={startConversation}
              className="space-y-2"
              encType="multipart/form-data"
            >
              <div className="flex items-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3">
                <Search className="size-4 text-[#766d62]" />
                <input
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  name="username"
                  placeholder="username"
                  required
                />
              </div>
              <WordLimitedField
                as="textarea"
                className="min-h-20 w-full rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 text-sm outline-none focus:border-[#171412]"
                emojiShortcuts
                maxCharacters={4000}
                maxLength={4000}
                name="body"
                placeholder="Start a message"
                wrapperClassName="space-y-2"
              />
              <details className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                  <ImagePlus className="size-4" />
                  Attach photo
                </summary>
                <div className="mt-3">
                  <MediaInput
                    accept={imageAccept}
                    compact
                    maxImageBytes={10 * 1024 * 1024}
                    name="media"
                    videoAllowed={false}
                  />
                </div>
              </details>
              <PendingSubmitButton
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                pendingLabel="Sending"
              >
                <Send className="size-4" />
                Send
              </PendingSubmitButton>
            </form>
          </header>

          {params.message ? (
            <p className="border-b border-[#cfc8bd] bg-[#e8e4dc] px-4 py-3 text-sm font-medium">
              {params.message}
            </p>
          ) : null}

          <section className="divide-y divide-[#cfc8bd]">
            {inbox.length ? (
              inbox.map((conversation) => {
                const profile = conversation.otherProfile;
                const active = selectedConversation?.id === conversation.id;
                const hasUnread = conversation.unreadCount > 0;

                return (
                  <Link
                    className={`block px-4 py-4 ${
                      active
                        ? "bg-[#e8e4dc]"
                        : hasUnread
                          ? "bg-[#fffdf9] hover:bg-[#e8e4dc]"
                          : "bg-[#f2f1ee] hover:bg-[#fffdf9]"
                    }`}
                    href={`/messages?c=${conversation.id}`}
                    key={conversation.id}
                  >
                    <div className="flex items-center gap-3">
                      <ProfileAvatar profile={profile} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className={`truncate text-sm ${
                              hasUnread ? "font-bold" : "font-semibold"
                            }`}
                          >
                            {profile?.display_name ?? "TattooCore member"}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            {hasUnread ? (
                              <span className="flex min-w-5 items-center justify-center rounded-full bg-[#171412] px-1.5 text-[10px] font-bold text-white">
                                {conversation.unreadCount > 9
                                  ? "9+"
                                  : conversation.unreadCount}
                              </span>
                            ) : null}
                            {conversation.latestMessage ? (
                              <p className="text-xs text-[#766d62]">
                                {timeAgo(conversation.latestMessage.created_at)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <p className="truncate text-xs text-[#766d62]">
                          @{profile?.username ?? "member"}{" "}
                          {profileLocation(profile)
                            ? ` - ${profileLocation(profile)}`
                            : ""}
                        </p>
                        <p
                          className={`mt-1 truncate text-sm ${
                            hasUnread ? "font-semibold text-[#171412]" : "text-[#4f473f]"
                          }`}
                        >
                          {conversation.latestMessage?.body ?? "No DMs yet."}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center">
                <Inbox className="mx-auto mb-3 size-8 text-[#766d62]" />
                <p className="text-sm font-semibold">No conversations yet</p>
                <p className="mt-1 text-sm text-[#766d62]">
                  Search a username above to send the first DM.
                </p>
              </div>
            )}
          </section>
        </aside>

        <section className="flex min-h-screen flex-col bg-[#f2f1ee]">
          {selectedConversation ? (
            <>
              <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <ProfileAvatar profile={selectedConversation.otherProfile} />
                  <div>
                    <h2 className="text-base font-bold">
                      {selectedConversation.otherProfile?.display_name ??
                        "TattooCore member"}
                    </h2>
                    <p className="text-xs text-[#766d62]">
                      @{selectedConversation.otherProfile?.username ?? "member"}
                    </p>
                  </div>
                </div>
              </header>

              <MessageThread
                conversationId={selectedConversation.id}
                currentUserId={claims.sub}
                initialMessages={selectedMessagesWithAttachments}
                key={`${selectedConversation.id}:${
                  selectedMessages[selectedMessages.length - 1]?.id ?? "empty"
                }`}
                profiles={(profiles ?? []).map((profile) => ({
                  display_name: profile.display_name,
                  avatar_url: profile.avatar_url,
                  id: profile.id,
                  username: profile.username,
                }))}
              />

              <form
                action={sendMessage}
                className="sticky bottom-0 space-y-3 border-t border-[#cfc8bd] bg-[#f2f1ee] p-4"
                encType="multipart/form-data"
              >
                <input
                  name="conversation_id"
                  type="hidden"
                  value={selectedConversation.id}
                />
                <div className="flex items-end gap-2">
                  <WordLimitedField
                    as="textarea"
                    className="min-h-12 w-full resize-none rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 py-2 text-sm outline-none focus:border-[#171412]"
                    emojiShortcuts
                    maxCharacters={4000}
                    maxLength={4000}
                    name="body"
                    placeholder="Message"
                    wrapperClassName="min-w-0 flex-1 space-y-2"
                  />
                  <PendingSubmitButton
                    aria-label="Send message"
                    className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[#171412] text-white"
                    pendingChildren={
                      <LoaderCircle className="size-5 animate-spin" />
                    }
                  >
                    <Send className="size-5" />
                  </PendingSubmitButton>
                </div>
                <details className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                    <ImagePlus className="size-4" />
                    Attach photo
                  </summary>
                  <div className="mt-3">
                    <MediaInput
                      accept={imageAccept}
                      compact
                      maxImageBytes={10 * 1024 * 1024}
                      name="media"
                      videoAllowed={false}
                    />
                  </div>
                </details>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="max-w-sm text-center">
                <MessageCircle className="mx-auto mb-3 size-10 text-[#766d62]" />
                <h2 className="text-lg font-bold">Your DMs</h2>
                <p className="mt-2 text-sm leading-6 text-[#766d62]">
                  Start a conversation from the inbox panel to trade booking
                  details, flash info, guest spots, and marketplace questions.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
