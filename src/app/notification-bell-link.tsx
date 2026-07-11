import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

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

  const { count } = recipientId
    ? await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", recipientId)
        .is("read_at", null)
    : { count: 0 };

  const unreadCount = count ?? 0;
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
