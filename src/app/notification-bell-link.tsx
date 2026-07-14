import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

type BlockRelation = {
  blocked_id: string;
  blocker_id: string;
};

type NotificationActor = {
  actor_id: string | null;
};

async function getBlockedProfileIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .returns<BlockRelation[]>();

  return new Set(
    (data ?? []).map((block) =>
      block.blocker_id === userId ? block.blocked_id : block.blocker_id,
    ),
  );
}

export async function NotificationBellLink({
  className = "",
  userId,
}: {
  className?: string;
  userId?: string;
}) {
  const supabase = await createClient();
  let recipientId = userId;

  if (!recipientId) {
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims as Claims | undefined;
    recipientId = claims?.sub;
  }

  const [blockedProfileIds, unreadNotifications] = recipientId
    ? await Promise.all([
        getBlockedProfileIds(supabase, recipientId),
        supabase
          .from("notifications")
          .select("actor_id")
          .eq("recipient_id", recipientId)
          .is("read_at", null)
          .limit(50)
          .returns<NotificationActor[]>(),
      ])
    : [new Set<string>(), { data: [] as NotificationActor[] }];

  const unreadCount =
    unreadNotifications.data?.filter(
      (notification) =>
        !notification.actor_id || !blockedProfileIds.has(notification.actor_id),
    ).length ?? 0;
  const label = unreadCount
    ? `Notifications, ${unreadCount} unread`
    : "Notifications";

  return (
    <Link
      aria-label={label}
      className={`relative flex size-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] ${className}`}
      href={recipientId ? "/notifications" : "/login"}
    >
      <Bell className="size-5" />
      {unreadCount ? (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[var(--foreground)] px-1 text-[10px] font-bold text-[var(--background)]">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
