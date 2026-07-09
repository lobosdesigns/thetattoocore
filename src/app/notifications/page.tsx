import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  Heart,
  MessageCircle,
  Settings,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
    | "thread_like";
  profiles: {
    display_name: string;
    username: string;
  } | null;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Notifications",
};

function notificationIcon(type: Notification["type"]) {
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
      "id, actor_id, subject_id, type, subject_type, title, body, href, read_at, created_at, profiles:profiles!notifications_actor_id_fkey(display_name, username)",
    )
    .eq("recipient_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Notification[]>();

  const unreadCount =
    notifications?.filter((notification) => !notification.read_at).length ?? 0;

  return (
    <main className="min-h-screen bg-[#202020] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-3xl bg-[#f2f1ee] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)]">
        <header className="sticky top-0 z-10 border-b border-[#cfc8bd] bg-[#f2f1ee]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to home"
                className="flex size-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-[#fffdf9]"
                href="/"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Notifications</h1>
                <p className="text-xs text-[#766d62]">
                  {unreadCount ? `${unreadCount} unread` : "All caught up"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                className="flex h-10 items-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 text-sm font-semibold"
                href="/account#notification-settings"
              >
                <Settings className="size-4" />
                Settings
              </Link>
              {unreadCount ? (
                <form action={markAllNotificationsRead}>
                  <button className="flex h-10 items-center gap-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-3 text-sm font-semibold">
                    <Check className="size-4" />
                    Mark all read
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </header>

        <section className="divide-y divide-[#cfc8bd]">
          {notifications?.length ? (
            notifications.map((notification) => {
              const Icon = notificationIcon(notification.type);
              const href = notificationHref(notification);
              const card = (
                <article
                  className={`flex gap-3 px-4 py-4 ${
                    notification.read_at ? "bg-[#f2f1ee]" : "bg-[#fffdf9]"
                  }`}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#cfc8bd] bg-white text-[#171412]">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">
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
                        <p className="mt-1 text-sm leading-6 text-[#4f473f]">
                          {notification.body}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-[#766d62]">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {href ? (
                        <form action={openNotification}>
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
                          <button className="h-9 rounded-md bg-[#171412] px-3 text-sm font-semibold text-white">
                            Open
                          </button>
                        </form>
                      ) : null}
                      {notification.type === "follow_request" &&
                      !notification.read_at &&
                      (notification.actor_id || notification.subject_id) ? (
                        <form
                          action={respondToFollowRequest}
                          className="flex gap-2"
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
                        <form action={markNotificationRead}>
                          <input
                            name="notification_id"
                            type="hidden"
                            value={notification.id}
                          />
                          <button className="h-9 rounded-md border border-[#cfc8bd] bg-white px-3 text-sm font-semibold">
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
