import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  ImagePlus,
  Inbox,
  LoaderCircle,
  MessageCircle,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MediaInput } from "@/app/media-input";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { ProfileAvatar } from "@/app/profile-avatar";
import { WordLimitedField } from "@/app/word-limited-field";
import {
  bookingPaymentStatusLabel,
  bookingStatusLabel,
} from "@/lib/status-labels";
import {
  cancelAcceptedBookingAsArtist,
  cancelBookingRequest,
  requestBookingRefundReview,
  respondBookingRequest,
} from "@/app/account/actions";
import { MessageStartForm } from "./message-start-form";
import { MessageThread } from "./message-thread";
import { sendMessage } from "./actions";

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
  last_read_at: string | null;
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
  id: string;
  subject_id: string | null;
};

type FollowRow = {
  follower_id: string;
  following_id: string;
};

type BookingRequest = {
  appointment_type_label: string | null;
  artist_id: string;
  artist_note: string | null;
  body: string;
  client_id: string;
  created_at: string;
  currency: string;
  deposit_amount_cents: number;
  id: string;
  payment_status: string;
  platform_fee_cents: number;
  preferred_city: string | null;
  preferred_dates: string | null;
  preferred_slot_label: string | null;
  scheduled_end_at: string | null;
  scheduled_start_at: string | null;
  scheduled_timezone: string | null;
  status: string;
  style_tags: string | null;
  title: string;
};

const imageAccept = "image/jpeg,image/png,image/webp,image/gif";

function loginPathForMessages(params: {
  c?: string;
  inboxPage?: string;
  to?: string;
}) {
  const returnParams = new URLSearchParams();

  if (params.c) returnParams.set("c", params.c);
  if (params.inboxPage) returnParams.set("inboxPage", params.inboxPage);
  if (params.to) returnParams.set("to", params.to);

  const query = returnParams.toString();
  const returnTo = `/messages${query ? `?${query}` : ""}`;

  return `/login?return_to=${encodeURIComponent(returnTo)}`;
}

function messagesInboxPath(message: string) {
  return `/messages?message=${encodeURIComponent(message)}`;
}

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

async function getBlockedProfileIds({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId?: string | null;
}) {
  if (!userId) return new Set<string>();

  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .returns<{ blocked_id: string; blocker_id: string }[]>();

  return new Set(
    (data ?? []).map((block) =>
      block.blocker_id === userId ? block.blocked_id : block.blocker_id,
    ),
  );
}

function money(cents: number, currency: string) {
  return Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not provided";
}

function formatBookingDateTime(value: string | null, timezone?: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + (timezone ? ` ${timezone}` : "");
}

function statusClass(status: string) {
  if (status === "paid" || status === "deposit_paid" || status === "completed") {
    return "border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]";
  }

  if (status === "accepted" || status === "deposit_pending") {
    return "border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_13%,var(--paper-warm))] text-[color-mix(in_srgb,var(--gold)_70%,var(--foreground))]";
  }

  if (status === "declined" || status === "cancelled" || status === "payment_failed") {
    return "border-[color-mix(in_srgb,var(--danger)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] text-[var(--danger)]";
  }

  return "border-[color-mix(in_srgb,#5078c8_35%,var(--card-rim))] bg-[color-mix(in_srgb,#5078c8_10%,var(--paper-warm))] text-[color-mix(in_srgb,#284f8a_78%,var(--foreground))]";
}

function notificationConversationId(notification: MessageNotification) {
  if (notification.href) {
    const [, query] = notification.href.split("?");
    if (query) {
      const conversationId = new URLSearchParams(query).get("c");
      if (conversationId) return conversationId;
    }
  }

  return notification.subject_id;
}

function BookingCards({
  bookings,
  currentUserId,
  returnPath,
}: {
  bookings: BookingRequest[];
  currentUserId: string;
  returnPath: string;
}) {
  if (!bookings.length) return null;

  return (
    <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] px-4 py-4">
      <div className="mx-auto grid w-full max-w-3xl gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-strong)]">
          <CalendarDays className="size-4 text-[var(--gold)]" />
          Booking
        </div>
        {bookings.map((booking) => {
          const isArtist = booking.artist_id === currentUserId;
          const isClient = booking.client_id === currentUserId;
          const canRespond =
            isArtist &&
            booking.status === "requested" &&
            booking.payment_status === "not_ready";
          const canPay =
            isClient &&
            booking.status === "accepted" &&
            booking.payment_status !== "paid" &&
            booking.deposit_amount_cents > 0;
          const canCancel =
            isClient &&
            ["requested", "accepted"].includes(booking.status) &&
            ["not_ready", "payment_failed"].includes(booking.payment_status);
          const canCancelAsArtist =
            isArtist &&
            booking.status === "accepted" &&
            ["not_ready", "payment_failed"].includes(booking.payment_status);

          return (
            <article
              className="rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_95%,transparent)] p-4 shadow-sm"
              key={booking.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{booking.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted-strong)]">
                    {isArtist ? "Incoming request" : "Sent request"} -{" "}
                    {formatDate(booking.created_at)}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold capitalize ${statusClass(
                    booking.status,
                  )}`}
                >
                  {bookingStatusLabel(booking.status)}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                {booking.body}
              </p>
              <div className="mt-3 grid gap-1 text-xs leading-5 text-[var(--muted-strong)]">
                <p>
                  Deposit: {money(booking.deposit_amount_cents, booking.currency)}
                  {" "}+ TTC fee{" "}
                  {money(booking.platform_fee_cents, booking.currency)}
                </p>
                <p>
                  Total checkout:{" "}
                  {money(
                    booking.deposit_amount_cents + booking.platform_fee_cents,
                    booking.currency,
                  )}
                </p>
                <p>Payment: {bookingPaymentStatusLabel(booking.payment_status)}</p>
                {booking.style_tags ? <p>Style: {booking.style_tags}</p> : null}
                {booking.preferred_city ? <p>City: {booking.preferred_city}</p> : null}
                {booking.appointment_type_label ? (
                  <p>Type: {booking.appointment_type_label}</p>
                ) : null}
                {booking.preferred_slot_label ? (
                  <p>Preferred slot: {booking.preferred_slot_label}</p>
                ) : null}
                {booking.preferred_dates ? (
                  <p>Dates: {booking.preferred_dates}</p>
                ) : null}
                {booking.scheduled_start_at ? (
                  <p>
                    Scheduled:{" "}
                    {formatBookingDateTime(
                      booking.scheduled_start_at,
                      booking.scheduled_timezone,
                    )}
                  </p>
                ) : null}
                {booking.artist_note ? <p>Note: {booking.artist_note}</p> : null}
              </div>
              {canRespond ? (
                <form action={respondBookingRequest} className="mt-4 grid gap-2">
                  <input name="booking_id" type="hidden" value={booking.id} />
                  <input name="return_to" type="hidden" value={returnPath} />
                  <input
                    name="scheduled_timezone"
                    type="hidden"
                    value={booking.scheduled_timezone ?? "America/Chicago"}
                  />
                  <textarea
                    className="ttc-surface min-h-16 rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    maxLength={1000}
                    name="artist_note"
                    placeholder="Optional note for the client"
                  />
                  <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
                    Final deposit amount
                    <input
                      className="ttc-surface h-10 rounded-md border px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                      defaultValue={
                        booking.deposit_amount_cents
                          ? (booking.deposit_amount_cents / 100).toFixed(2)
                          : ""
                      }
                      inputMode="decimal"
                      name="final_deposit_amount"
                      placeholder="Example: 100"
                    />
                    <span className="text-[11px] font-normal leading-4 text-[var(--muted-strong)]">
                      This is the deposit checkout amount before the TTC fee is
                      added.
                    </span>
                  </label>
                  <details className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
                    <summary className="cursor-pointer list-none text-xs font-bold">
                      Add appointment time
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold">
                        Start
                        <input
                          className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                          name="scheduled_start_at"
                          type="datetime-local"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">
                        End
                        <input
                          className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                          name="scheduled_end_at"
                          type="datetime-local"
                        />
                      </label>
                    </div>
                  </details>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <PendingSubmitButton
                      className="h-10 rounded-md border border-[color-mix(in_srgb,#34a853_38%,var(--card-rim))] bg-[color-mix(in_srgb,#34a853_12%,var(--paper-warm))] px-4 text-sm font-bold text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
                      name="decision"
                      pendingLabel="Accepting"
                      value="accept"
                    >
                      Accept
                    </PendingSubmitButton>
                    <PendingSubmitButton
                      className="h-10 rounded-md border border-[color-mix(in_srgb,var(--danger)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-4 text-sm font-bold text-[var(--danger)]"
                      name="decision"
                      pendingLabel="Declining"
                      value="decline"
                    >
                      Decline
                    </PendingSubmitButton>
                  </div>
                </form>
              ) : null}
              {canPay ? (
                <form action="/api/bookings/checkout" className="mt-4" method="post">
                  <input name="booking_id" type="hidden" value={booking.id} />
                  <input name="return_to" type="hidden" value={returnPath} />
                  <button
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--gold)_45%,var(--card-rim))] bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)] sm:w-fit"
                    disabled={booking.payment_status === "checkout_started"}
                  >
                    <CreditCard className="size-4" />
                    {booking.payment_status === "checkout_started"
                      ? "Checkout started"
                      : "Pay deposit"}
                  </button>
                </form>
              ) : null}
              {booking.scheduled_start_at ? (
                <Link
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] px-3 text-xs font-bold"
                  href={`/api/bookings/${booking.id}/calendar`}
                >
                  Add to calendar
                </Link>
              ) : null}
              {booking.status === "deposit_paid" &&
              booking.payment_status === "paid" ? (
                <details className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_92%,transparent)] p-3">
                  <summary className="cursor-pointer list-none text-xs font-bold">
                    Request refund review
                  </summary>
                  <form action={requestBookingRefundReview} className="mt-3 grid gap-2">
                    <input name="booking_id" type="hidden" value={booking.id} />
                    <input name="return_to" type="hidden" value={returnPath} />
                    <textarea
                      className="min-h-20 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                      maxLength={500}
                      name="refund_reason"
                      placeholder="Reason for admin review"
                    />
                    <PendingSubmitButton
                      className="flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[var(--foreground)] px-4 text-sm font-bold text-[var(--background)] sm:w-fit"
                      pendingLabel="Requesting"
                    >
                      Send review request
                    </PendingSubmitButton>
                  </form>
                </details>
              ) : null}
              {canCancel ? (
                <form action={cancelBookingRequest} className="mt-3">
                  <input name="booking_id" type="hidden" value={booking.id} />
                  <input name="return_to" type="hidden" value={returnPath} />
                  <PendingSubmitButton
                    className="flex h-10 w-full items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--danger)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-4 text-sm font-bold text-[var(--danger)] sm:w-fit"
                    pendingLabel="Cancelling"
                  >
                    Cancel request
                  </PendingSubmitButton>
                </form>
              ) : null}
              {canCancelAsArtist ? (
                <form action={cancelAcceptedBookingAsArtist} className="mt-3">
                  <input name="booking_id" type="hidden" value={booking.id} />
                  <input name="return_to" type="hidden" value={returnPath} />
                  <PendingSubmitButton
                    className="flex h-10 w-full items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--danger)_42%,var(--card-rim))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper-warm))] px-4 text-sm font-bold text-[var(--danger)] sm:w-fit"
                    pendingLabel="Cancelling"
                  >
                    Cancel accepted booking
                  </PendingSubmitButton>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    c?: string;
    inboxPage?: string;
    message?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const inboxPageSize = 25;
  const inboxPage = Math.max(1, Math.min(20, Number(params.inboxPage ?? "1") || 1));
  const conversationLimit = inboxPage * inboxPageSize;
  const conversationFetchLimit = conversationLimit + inboxPageSize;
  const messageWindowLimit = Math.min(conversationFetchLimit * 25, 500);
  const requestedConversationId = String(params.c ?? "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
  const prefillUsername = String(params.to ?? "")
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect(loginPathForMessages(params));
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, account_type, city, region")
    .eq("id", claims.sub)
    .maybeSingle<Profile>();

  if (!currentProfile) {
    return (
      <main className="ttc-page min-h-screen px-4 py-8">
        <section className="ttc-card ttc-surface mx-auto max-w-xl rounded-md border p-5">
          <h1 className="text-xl font-bold">Finish profile</h1>
          <p className="mt-2 text-sm text-[var(--muted-strong)]">
            Set up your profile before sending messages.
          </p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
            href="/account"
          >
            Profile
          </Link>
        </section>
      </main>
    );
  }

  const blockedProfileIds = await getBlockedProfileIds({
    supabase,
    userId: claims.sub,
  });
  const { data: connectedFollowRows } = await supabase
    .from("follows")
    .select("follower_id, following_id")
    .eq("status", "accepted")
    .or(`follower_id.eq.${claims.sub},following_id.eq.${claims.sub}`)
    .returns<FollowRow[]>();
  const connectedProfileIds = Array.from(
    new Set(
      (connectedFollowRows ?? [])
        .map((follow) =>
          follow.follower_id === claims.sub
            ? follow.following_id
            : follow.follower_id,
        )
        .filter((id) => id !== claims.sub && !blockedProfileIds.has(id)),
    ),
  );
  const { data: membershipRows } = await supabase
    .from("conversation_members")
    .select("conversation_id, created_at, last_read_at")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(conversationFetchLimit)
    .returns<Membership[]>();
  const memberships = [...(membershipRows ?? [])];

  if (
    requestedConversationId &&
    !memberships.some(
      (membership) => membership.conversation_id === requestedConversationId,
    )
  ) {
    const { data: selectedMembership } = await supabase
      .from("conversation_members")
      .select("conversation_id, created_at, last_read_at")
      .eq("user_id", claims.sub)
      .eq("conversation_id", requestedConversationId)
      .maybeSingle<Membership>();

    if (selectedMembership) {
      memberships.unshift(selectedMembership);
    }
  }
  const conversationIds = memberships.map(
    (membership) => membership.conversation_id,
  );

  const [
    { data: members },
    { data: messages },
    { data: unreadMessageNotifications },
  ] = await Promise.all([
    conversationIds.length
      ? supabase
          .from("conversation_members")
          .select("conversation_id, user_id, last_read_at")
          .in("conversation_id", conversationIds)
          .returns<ConversationMember[]>()
      : Promise.resolve({ data: [] as ConversationMember[] }),
    conversationIds.length
      ? supabase
          .from("messages")
          .select("id, body, conversation_id, sender_id, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(messageWindowLimit)
          .returns<Message[]>()
      : Promise.resolve({ data: [] as Message[] }),
    conversationIds.length
      ? supabase
          .from("notifications")
          .select("id, subject_id, href")
          .eq("recipient_id", claims.sub)
          .eq("type", "message")
          .is("read_at", null)
          .returns<MessageNotification[]>()
      : Promise.resolve({ data: [] as MessageNotification[] }),
  ]);

  const profileIds = Array.from(
    new Set((members ?? []).map((member) => member.user_id)),
  );
  const profileFetchIds = Array.from(
    new Set(
      [...connectedProfileIds, ...profileIds].filter(
        (id) => id === claims.sub || !blockedProfileIds.has(id),
      ),
    ),
  );
  const { data: profiles } = profileFetchIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, account_type, city, region")
        .in("id", profileFetchIds)
        .is("banned_at", null)
        .is("suspended_at", null)
        .returns<Profile[]>()
    : { data: [] as Profile[] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const connectedProfilesForPicker = [...(profiles ?? [])]
    .filter((profile) => profile.id !== claims.sub && !blockedProfileIds.has(profile.id))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const messagesByConversation = new Map<string, Message[]>();

  for (const message of (messages ?? []).toReversed()) {
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

  const filteredInbox = memberships
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
        isBlockedConversation: Boolean(
          otherMember && blockedProfileIds.has(otherMember.user_id),
        ),
        latestMessage,
        myLastReadAt: membership.last_read_at,
        otherLastReadAt: otherMember?.last_read_at ?? null,
        otherProfile,
        unreadCount:
          unreadCountByConversation.get(membership.conversation_id) ?? 0,
      };
    })
    .filter((conversation) => !conversation.isBlockedConversation)
    .sort((a, b) => {
      const aTime = new Date(a.latestMessage?.created_at ?? 0).getTime();
      const bTime = new Date(b.latestMessage?.created_at ?? 0).getTime();

      return bTime - aTime;
    });
  const inbox = filteredInbox.slice(0, conversationLimit);
  const hasMoreInbox =
    filteredInbox.length > conversationLimit ||
    (membershipRows?.length ?? 0) === conversationFetchLimit;

  const hasSelectedConversationParam = Boolean(requestedConversationId);
  const selectedConversation =
    (hasSelectedConversationParam
      ? inbox.find((conversation) => conversation.id === requestedConversationId)
      : inbox[0]) ?? null;

  if (hasSelectedConversationParam && !selectedConversation) {
    redirect(messagesInboxPath("Conversation was not found or is no longer available."));
  }

  const selectedMessages = selectedConversation
    ? messagesByConversation.get(selectedConversation.id) ?? []
    : [];

  if (selectedConversation) {
    const selectedUnreadNotificationIds = (unreadMessageNotifications ?? [])
      .filter(
        (notification) =>
          notificationConversationId(notification) === selectedConversation.id,
      )
      .map((notification) => notification.id);
    const latestIncomingMessage = selectedMessages
      .filter((message) => message.sender_id !== claims.sub)
      .at(-1);
    const latestIncomingAt = latestIncomingMessage
      ? new Date(latestIncomingMessage.created_at).getTime()
      : 0;
    const myLastReadAt = selectedConversation.myLastReadAt
      ? new Date(selectedConversation.myLastReadAt).getTime()
      : 0;
    const shouldMarkThreadRead =
      selectedUnreadNotificationIds.length > 0 ||
      (latestIncomingAt > 0 && latestIncomingAt > myLastReadAt);

    if (selectedUnreadNotificationIds.length) {
      const readAt = new Date().toISOString();
      await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("recipient_id", claims.sub)
        .in("id", selectedUnreadNotificationIds);
      unreadCountByConversation.set(selectedConversation.id, 0);
    }

    if (shouldMarkThreadRead) {
      await supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", selectedConversation.id)
        .eq("user_id", claims.sub);
    }
  }

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
  const { data: selectedBookings } = selectedConversation
    ? await supabase
        .from("booking_requests")
        .select(
          "id, client_id, artist_id, title, body, status, payment_status, deposit_amount_cents, platform_fee_cents, currency, style_tags, preferred_city, preferred_dates, appointment_type_label, preferred_slot_label, artist_note, scheduled_start_at, scheduled_end_at, scheduled_timezone, created_at",
        )
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: false })
        .limit(3)
        .returns<BookingRequest[]>()
    : { data: [] as BookingRequest[] };

  return (
    <main className="ttc-page h-[100dvh] overflow-hidden">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-1 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          className={`ttc-page-panel min-h-0 min-w-0 overflow-y-auto border-r border-[var(--card-rim)] ${
            hasSelectedConversationParam ? "hidden lg:block" : "block"
          }`}
        >
          <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] px-4 py-4 backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Link
                aria-label="Back to feed"
                className="ttc-surface flex size-10 items-center justify-center rounded-md border"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold">DM</h1>
                <p className="truncate text-xs text-[var(--muted-strong)]">
                  @{currentProfile.username}
                </p>
              </div>
              <ProfileAvatar profile={currentProfile} size="md" />
            </div>

            <MessageStartForm
              connectedProfiles={connectedProfilesForPicker}
              imageAccept={imageAccept}
              prefillUsername={prefillUsername}
            />
          </header>

          {params.message ? (
            <p className="ttc-surface border-b border-[var(--card-rim)] px-4 py-3 text-sm font-medium">
              {params.message}
            </p>
          ) : null}

          <section className="divide-y divide-[var(--card-rim)]">
            {inbox.length ? (
              inbox.map((conversation) => {
                const profile = conversation.otherProfile;
                const active = selectedConversation?.id === conversation.id;
                const hasUnread = conversation.unreadCount > 0;

                return (
                  <Link
                    className={`block px-4 py-4 ${
                      active
                        ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--paper))]"
                        : hasUnread
                          ? "bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--paper))]"
                          : "bg-[color-mix(in_srgb,var(--paper)_96%,transparent)] hover:bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)]"
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
                              <span className="flex min-w-5 items-center justify-center rounded-full bg-[var(--foreground)] px-1.5 text-[10px] font-bold text-[var(--background)]">
                                {conversation.unreadCount > 9
                                  ? "9+"
                                  : conversation.unreadCount}
                              </span>
                            ) : null}
                            {conversation.latestMessage ? (
                              <p className="text-xs text-[var(--muted-strong)]">
                                {timeAgo(conversation.latestMessage.created_at)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <p className="truncate text-xs text-[var(--muted-strong)]">
                          @{profile?.username ?? "member"}{" "}
                          {profileLocation(profile)
                            ? ` - ${profileLocation(profile)}`
                            : ""}
                        </p>
                        <p
                          className={`mt-1 truncate text-sm ${
                            hasUnread ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"
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
                <Inbox className="mx-auto mb-3 size-8 text-[var(--muted-strong)]" />
                <p className="text-sm font-semibold">No conversations yet</p>
                <p className="mt-1 text-sm text-[var(--muted-strong)]">
                  Search a username above to send the first DM.
                </p>
              </div>
            )}
          </section>
          {hasMoreInbox ? (
            <div className="border-t border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_96%,transparent)] px-4 py-4">
              <Link
                className="ttc-surface flex h-10 items-center justify-center rounded-md border px-4 text-sm font-bold shadow-sm"
                href={`/messages?inboxPage=${inboxPage + 1}`}
              >
                Load 25 more conversations
              </Link>
            </div>
          ) : null}
        </aside>

        <section
          className={`ttc-page-panel min-h-0 min-w-0 flex-col overflow-hidden ${
            hasSelectedConversationParam ? "flex h-[100dvh]" : "hidden h-full lg:flex"
          }`}
        >
          {selectedConversation ? (
            <>
              <header className="z-10 shrink-0 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] px-4 py-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <Link
                    aria-label="Back to DM inbox"
                    className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border lg:hidden"
                    href="/messages"
                  >
                    <ArrowLeft className="size-5" />
                  </Link>
                  {selectedConversation.otherProfile?.username ? (
                    <Link
                      className="flex min-w-0 items-center gap-3"
                      href={`/u/${selectedConversation.otherProfile.username}`}
                    >
                      <ProfileAvatar profile={selectedConversation.otherProfile} />
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold">
                          {selectedConversation.otherProfile.display_name}
                        </h2>
                        <p className="truncate text-xs text-[var(--muted-strong)]">
                          @{selectedConversation.otherProfile.username}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <>
                      <ProfileAvatar profile={selectedConversation.otherProfile} />
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold">
                          TattooCore member
                        </h2>
                        <p className="truncate text-xs text-[var(--muted-strong)]">
                          @member
                        </p>
                      </div>
                    </>
                  )}
                  {selectedConversation.otherProfile &&
                  ["artist", "studio"].includes(
                    selectedConversation.otherProfile.account_type,
                  ) ? (
                    <Link
                      className="ml-auto hidden h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--gold)_40%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_14%,var(--paper-warm))] px-3 text-xs font-bold text-[var(--foreground)] sm:inline-flex"
                      href={`/u/${selectedConversation.otherProfile.username}#booking-request`}
                    >
                      <CalendarDays className="size-4" />
                      Request booking
                    </Link>
                  ) : null}
                </div>
                {selectedConversation.otherProfile &&
                ["artist", "studio"].includes(
                  selectedConversation.otherProfile.account_type,
                ) ? (
                  <Link
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--gold)_40%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_14%,var(--paper-warm))] px-3 text-xs font-bold text-[var(--foreground)] sm:hidden"
                    href={`/u/${selectedConversation.otherProfile.username}#booking-request`}
                  >
                    <CalendarDays className="size-4" />
                    Request booking
                  </Link>
                ) : null}
              </header>

              <BookingCards
                bookings={selectedBookings ?? []}
                currentUserId={claims.sub}
                returnPath={`/messages?c=${selectedConversation.id}`}
              />

              <MessageThread
                conversationId={selectedConversation.id}
                currentUserId={claims.sub}
                initialMessages={selectedMessagesWithAttachments}
                key={`${selectedConversation.id}:${
                  selectedMessages[selectedMessages.length - 1]?.id ?? "empty"
                }`}
                otherLastReadAt={selectedConversation.otherLastReadAt}
                profiles={(profiles ?? []).map((profile) => ({
                  display_name: profile.display_name,
                  avatar_url: profile.avatar_url,
                  id: profile.id,
                  username: profile.username,
                }))}
              />

              <form
                action={sendMessage}
                className="shrink-0 space-y-3 border-t border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] p-4"
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
                    className="ttc-surface min-h-12 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                    emojiShortcuts
                    maxCharacters={4000}
                    maxLength={4000}
                    name="body"
                    placeholder="Message"
                    wrapperClassName="min-w-0 flex-1 space-y-2"
                  />
                  <PendingSubmitButton
                    aria-label="Send message"
                    className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)]"
                    pendingChildren={
                      <LoaderCircle className="size-5 animate-spin" />
                    }
                  >
                    <Send className="size-5" />
                  </PendingSubmitButton>
                </div>
                <details className="ttc-surface rounded-md border p-3">
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
                <MessageCircle className="mx-auto mb-3 size-10 text-[var(--muted-strong)]" />
                <h2 className="text-lg font-bold">Your DMs</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                  Start a conversation from the inbox panel to trade booking
                  details, flash info, guest spots, and Stuff questions.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
