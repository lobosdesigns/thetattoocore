import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Check,
  CreditCard,
  Heart,
  MessageCircle,
  ShieldAlert,
  Smartphone,
  Settings,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PwaInstallButton } from "@/app/pwa-install-button";
import { ProfileAvatar } from "@/app/profile-avatar";
import {
  markAllNotificationsRead,
  markNotificationRead,
  openNotification,
  respondToFollowRequest,
} from "./actions";

type Claims = {
  sub: string;
};

type Notification = {
  id: string;
  actor_id: string | null;
  body: string | null;
  created_at: string;
  href: string | null;
  read_at: string | null;
  subject_id: string | null;
  subject_type: string;
  title: string;
  type:
    | "feed_comment"
    | "feed_like"
    | "follow_accepted"
    | "follow_request"
    | "ad_paid"
    | "ad_payment_failed"
    | "ad_refunded"
    | "message"
    | "merch_paid"
    | "merch_fulfilled"
    | "merch_refunded"
    | "merch_payment_failed"
    | "merch_cancelled"
    | "new_follow"
    | "thread_comment"
    | "thread_like"
    | "verification_approved"
    | "verification_rejected";
  profiles: {
    avatar_url: string | null;
    display_name: string;
    username: string;
  } | null;
};

type NotificationProfile = {
  notification_quiet_hours_enabled: boolean | null;
  notification_quiet_hours_end: string | null;
  notification_quiet_hours_start: string | null;
  notification_timezone: string | null;
  notify_email_important: boolean | null;
  notify_push_enabled: boolean | null;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Notifications",
};

function notificationIcon(type: Notification["type"]) {
  if (type === "verification_approved") return BadgeCheck;
  if (type === "verification_rejected") return ShieldAlert;
  if (type === "ad_payment_failed") return ShieldAlert;
  if (type === "ad_paid") return CreditCard;
  if (type === "ad_refunded") return CreditCard;
  if (type === "merch_paid") return CreditCard;
  if (type === "merch_fulfilled") return BadgeCheck;
  if (type === "merch_refunded") return CreditCard;
  if (type === "merch_payment_failed" || type === "merch_cancelled") {
    return ShieldAlert;
  }
  if (type === "message") return MessageCircle;
  if (type === "feed_like" || type === "thread_like") return Heart;
  if (type === "feed_comment" || type === "thread_comment") {
    return MessageCircle;
  }

  return UserPlus;
}

function subjectLabel(type: string) {
  if (type === "feed_post") return "4U";
  if (type === "thread_post") return "Gossip";
  if (type === "marketplace_listing") return "Stuff";
  if (type === "gig") return "Gigs";
  if (type === "profile") return "Profile";
  if (type === "message") return "DM";
  if (type === "conversation") return "DM";
  if (type === "ad_campaign") return "Ad";
  if (type === "merch_order") return "Merch order";
  if (type === "merch_product") return "Merch";
  if (type === "license_verification_request") return "Verification";

  return type.replaceAll("_", " ");
}

function notificationHref(notification: Notification) {
  if (notification.subject_type === "feed_post" && notification.subject_id) {
    return `/p/${notification.subject_id}`;
  }

  if (notification.subject_type === "thread_post" && notification.subject_id) {
    return `/t/${notification.subject_id}`;
  }

  return notification.href;
}

function timeAgo(date: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - Date.parse(date)) / 1000));

  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function shortTime(value: string | null | undefined, fallback: string) {
  return value?.slice(0, 5) || fallback;
}

function notificationsLoginPath(page: number) {
  const returnTo = page > 1 ? `/notifications?page=${page}` : "/notifications";

  return `/login?return_to=${encodeURIComponent(returnTo)}`;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(20, Number(params.page ?? "1") || 1));
  const notificationLimit = page * 25;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect(notificationsLoginPath(page));
  }

  const { data: notifications } = await supabase
    .from("notifications")
    .select(
      "id, actor_id, subject_id, type, subject_type, title, body, href, read_at, created_at, profiles:profiles!notifications_actor_id_fkey(avatar_url, display_name, username)",
    )
    .eq("recipient_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(notificationLimit)
    .returns<Notification[]>();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "notification_quiet_hours_enabled, notification_quiet_hours_start, notification_quiet_hours_end, notification_timezone, notify_email_important, notify_push_enabled",
    )
    .eq("id", claims.sub)
    .maybeSingle<NotificationProfile>();

  const unreadCount =
    notifications?.filter((notification) => !notification.read_at).length ?? 0;

  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-3xl overflow-x-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_28px_90px_rgba(0,0,0,0.42)]">
        <header className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="grid min-w-0 gap-3 sm:flex sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to home"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl font-bold">Notifications</h1>
                <p className="text-xs text-[var(--muted-strong)]">
                  {unreadCount
                    ? `${unreadCount} unread - latest ${notificationLimit} shown`
                    : `All caught up - latest ${notificationLimit} shown`}
                </p>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-none sm:items-center sm:justify-end">
              <Link
                className="ttc-surface flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-sm"
                href="/account#notification-settings"
              >
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
              {unreadCount ? (
                <form action={markAllNotificationsRead} className="min-w-0">
                  <button className="ttc-surface flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-sm">
                    <Check className="size-4" />
                    <span className="hidden min-[390px]:inline">Mark all read</span>
                    <span className="min-[390px]:hidden">Read</span>
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </header>

        <section className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_80%,transparent)] px-4 py-4 backdrop-blur">
          <div className="ttc-surface flex min-w-0 gap-3 rounded-md border p-3 shadow-sm">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--gold)_50%,var(--card-rim))] bg-[var(--foreground)] text-[var(--gold)] shadow-[0_0_18px_rgba(200,149,59,0.15)]">
              <Smartphone className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold">Push notifications later</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                In-app alerts and badges are live now. These preferences will
                carry forward to email, installed-web-app push, and native
                iOS/Android push when those channels are added.
              </p>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted)] sm:grid-cols-3">
                <p className="ttc-surface rounded-md border px-2 py-1">
                  Quiet hours:{" "}
                  <span className="font-semibold">
                    {profile?.notification_quiet_hours_enabled
                      ? `${shortTime(
                          profile.notification_quiet_hours_start,
                          "22:00",
                        )}-${shortTime(
                          profile.notification_quiet_hours_end,
                          "08:00",
                        )}`
                      : "Off"}
                  </span>
                </p>
                <p className="ttc-surface rounded-md border px-2 py-1">
                  Important email:{" "}
                  <span className="font-semibold">
                    {profile?.notify_email_important === false ? "Off" : "On"}
                  </span>
                </p>
                <p className="ttc-surface rounded-md border px-2 py-1">
                  Push intent:{" "}
                  <span className="font-semibold">
                    {profile?.notify_push_enabled ? "Saved" : "Off"}
                  </span>
                </p>
              </div>
              <div className="mt-3 max-w-xs">
                <PwaInstallButton />
              </div>
            </div>
          </div>
        </section>

        <section className="divide-y divide-[var(--card-rim)]">
          {notifications?.length ? (
            notifications.map((notification) => {
              const Icon = notificationIcon(notification.type);
              const href = notificationHref(notification);
              const card = (
                <article
                  className={`flex min-w-0 gap-3 px-4 py-4 ${
                    notification.read_at
                      ? "bg-[color-mix(in_srgb,var(--paper)_92%,transparent)]"
                      : "bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)]"
                  }`}
                >
                  <div className="relative shrink-0">
                    <ProfileAvatar
                      className="border border-[var(--card-rim)]"
                      profile={notification.profiles}
                      size="md"
                    />
                    <span className="ttc-surface absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-md border shadow-sm">
                      <Icon className="size-3" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 break-words">
                        <p className="text-sm font-bold break-words">
                          {notification.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-strong)]">
                          {notification.profiles ? (
                            <span>@{notification.profiles.username}</span>
                          ) : null}
                          <span className="ttc-surface rounded-md border px-1.5 py-0.5 font-semibold capitalize">
                            {subjectLabel(notification.subject_type)}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">
                          {notification.body}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-[var(--muted-strong)]">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap">
                      {href ? (
                        <form action={openNotification} className="min-w-0">
                          <input
                            name="notification_id"
                            type="hidden"
                            value={notification.id}
                          />
                          <input
                            name="href"
                            type="hidden"
                            value={href}
                          />
                          <button className="ttc-control-active h-9 w-full rounded-md border px-3 text-sm font-semibold sm:w-auto">
                            Open
                          </button>
                        </form>
                      ) : null}
                      {notification.type === "follow_request" &&
                      !notification.read_at &&
                      (notification.actor_id || notification.subject_id) ? (
                        <form
                          action={respondToFollowRequest}
                          className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:col-span-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap"
                        >
                          <input
                            name="notification_id"
                            type="hidden"
                            value={notification.id}
                          />
                          <input
                            name="follower_id"
                            type="hidden"
                            value={
                              notification.actor_id ??
                              notification.subject_id ??
                              ""
                            }
                          />
                          <button
                            className="ttc-control-active h-9 rounded-md border px-3 text-sm font-semibold"
                            name="decision"
                            value="accept"
                          >
                            Accept
                          </button>
                          <button
                            className="ttc-surface h-9 rounded-md border px-3 text-sm font-semibold"
                            name="decision"
                            value="decline"
                          >
                            Decline
                          </button>
                        </form>
                      ) : null}
                      {!notification.read_at ? (
                        <form action={markNotificationRead} className="min-w-0">
                          <input
                            name="notification_id"
                            type="hidden"
                            value={notification.id}
                          />
                          <button className="ttc-surface h-9 w-full rounded-md border px-3 text-sm font-semibold sm:w-auto">
                            Mark read
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </article>
              );

              return <div key={notification.id}>{card}</div>;
            })
          ) : (
            <div className="px-4 py-12 text-center">
              <Bell className="mx-auto mb-3 size-9 text-[var(--muted-strong)]" />
              <h2 className="text-lg font-bold">No notifications yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-strong)]">
                Follow requests, messages, likes, and comments will show up
                here.
              </p>
            </div>
          )}
        </section>
        {notifications?.length === notificationLimit ? (
          <div className="border-t border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] px-4 py-5 text-center">
            <Link
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold"
              href={`/notifications?page=${page + 1}`}
            >
              Load more
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
