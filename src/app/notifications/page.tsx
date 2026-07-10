import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Check,
  Heart,
  MessageCircle,
  ShieldAlert,
  Smartphone,
  Settings,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
    | "message"
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

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: notifications } = await supabase
    .from("notifications")
    .select(
      "id, actor_id, subject_id, type, subject_type, title, body, href, read_at, created_at, profiles:profiles!notifications_actor_id_fkey(avatar_url, display_name, username)",
    )
    .eq("recipient_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(50)
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
    <main className="min-h-screen overflow-x-hidden bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen w-full max-w-3xl overflow-x-hidden bg-[#ece8df] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_28px_90px_rgba(0,0,0,0.42)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#ece8df]/95 px-4 py-3 backdrop-blur">
          <div className="grid min-w-0 gap-3 sm:flex sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to home"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl font-bold">Notifications</h1>
                <p className="text-xs text-[#766d62]">
                  {unreadCount ? `${unreadCount} unread` : "All caught up"}
                </p>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-none sm:items-center sm:justify-end">
              <Link
                className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9]/95 px-3 text-sm font-semibold shadow-sm"
                href="/account#notification-settings"
              >
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
              {unreadCount ? (
                <form action={markAllNotificationsRead} className="min-w-0">
                  <button className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9]/95 px-3 text-sm font-semibold shadow-sm">
                    <Check className="size-4" />
                    <span className="hidden min-[390px]:inline">Mark all read</span>
                    <span className="min-[390px]:hidden">Read</span>
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </header>

        <section className="border-b border-[#cfc8bd] bg-[#fffdf9]/80 px-4 py-4 backdrop-blur">
          <div className="flex min-w-0 gap-3 rounded-md border border-[#d8d1c6] bg-white/90 p-3 shadow-sm">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#c8953b]/50 bg-[#171412] text-[#c8953b] shadow-[0_0_18px_rgba(200,149,59,0.15)]">
              <Smartphone className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold">Push notifications later</h2>
              <p className="mt-1 text-xs leading-5 text-[#766d62]">
                In-app alerts and badges are live now. These preferences will
                carry forward to email, installed-web-app push, and native
                iOS/Android push when those channels are added.
              </p>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-[#4f473f] sm:grid-cols-3">
                <p className="rounded-md border border-[#e5ded4] bg-[#fffdf9] px-2 py-1">
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
                <p className="rounded-md border border-[#e5ded4] bg-[#fffdf9] px-2 py-1">
                  Important email:{" "}
                  <span className="font-semibold">
                    {profile?.notify_email_important === false ? "Off" : "On"}
                  </span>
                </p>
                <p className="rounded-md border border-[#e5ded4] bg-[#fffdf9] px-2 py-1">
                  Push intent:{" "}
                  <span className="font-semibold">
                    {profile?.notify_push_enabled ? "Saved" : "Off"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="divide-y divide-[#cfc8bd]">
          {notifications?.length ? (
            notifications.map((notification) => {
              const Icon = notificationIcon(notification.type);
              const href = notificationHref(notification);
              const card = (
                <article
                  className={`flex min-w-0 gap-3 px-4 py-4 ${
                    notification.read_at ? "bg-[#ece8df]" : "bg-[#fffdf9]/95"
                  }`}
                >
                  <div className="relative shrink-0">
                    <ProfileAvatar
                      className="border border-[#cfc8bd]"
                      profile={notification.profiles}
                      size="md"
                    />
                    <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-md border border-[#cfc8bd] bg-white text-[#171412] shadow-sm">
                      <Icon className="size-3" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 break-words">
                        <p className="text-sm font-bold break-words">
                          {notification.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#766d62]">
                          {notification.profiles ? (
                            <span>@{notification.profiles.username}</span>
                          ) : null}
                          <span className="rounded-md border border-[#cfc8bd] bg-white px-1.5 py-0.5 font-semibold capitalize">
                            {subjectLabel(notification.subject_type)}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm leading-6 text-[#4f473f]">
                          {notification.body}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-[#766d62]">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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
                          <button className="h-9 w-full rounded-md bg-[#171412] px-3 text-sm font-semibold text-white sm:w-auto">
                            Open
                          </button>
                        </form>
                      ) : null}
                      {notification.type === "follow_request" &&
                      !notification.read_at &&
                      (notification.actor_id || notification.subject_id) ? (
                        <form
                          action={respondToFollowRequest}
                          className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap"
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
                            className="h-9 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
                            name="decision"
                            value="accept"
                          >
                            Accept
                          </button>
                          <button
                            className="h-9 rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold"
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
                          <button className="h-9 w-full rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold sm:w-auto">
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
              <Bell className="mx-auto mb-3 size-9 text-[#766d62]" />
              <h2 className="text-lg font-bold">No notifications yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#766d62]">
                Follow requests, messages, likes, and comments will show up
                here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
