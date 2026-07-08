import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  Heart,
  MessageCircle,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  markAllNotificationsRead,
  markNotificationRead,
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
      "id, actor_id, type, title, body, href, read_at, created_at, profiles:profiles!notifications_actor_id_fkey(display_name, username)",
    )
    .eq("recipient_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Notification[]>();

  const unreadCount =
    notifications?.filter((notification) => !notification.read_at).length ?? 0;

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#171412]">
      <div className="mx-auto min-h-screen max-w-3xl bg-[#fffdf9]">
        <header className="sticky top-0 z-10 border-b border-[#e5ded4] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Back to home"
                className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
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

            {unreadCount ? (
              <form action={markAllNotificationsRead}>
                <button className="flex h-10 items-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm font-semibold">
                  <Check className="size-4" />
                  Mark all read
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <section className="divide-y divide-[#e5ded4]">
          {notifications?.length ? (
            notifications.map((notification) => {
              const Icon = notificationIcon(notification.type);
              const card = (
                <article
                  className={`flex gap-3 px-4 py-4 ${
                    notification.read_at ? "bg-[#fffdf9]" : "bg-[#f7f4ef]"
                  }`}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#d8d1c6] bg-white">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#4f473f]">
                          {notification.body}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-[#766d62]">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {notification.href ? (
                        <Link
                          className="inline-flex h-9 items-center rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
                          href={notification.href}
                        >
                          Open
                        </Link>
                      ) : null}
                      {!notification.read_at ? (
                        <form action={markNotificationRead}>
                          <input
                            name="notification_id"
                            type="hidden"
                            value={notification.id}
                          />
                          <button className="h-9 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm font-semibold">
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
