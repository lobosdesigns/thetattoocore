"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  allowsInAppNotification,
  notificationPreferenceSelect,
  type NotificationPreferenceProfile,
} from "@/lib/notifications";
import { insertNotifications } from "@/lib/notification-write";
import {
  notificationPathOrFallback,
  safeNotificationPath,
} from "@/lib/notification-route";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

type NotificationOpenRow = {
  href: string | null;
  subject_id: string | null;
  subject_type: string;
  type: string;
};

const taggedSubjectConfig = {
  feed_comment_tag: {
    requireNotDeleted: true,
    subjectType: "post_comment",
    table: "post_comments",
  },
  feed_tag: {
    requireNotDeleted: false,
    subjectType: "feed_post",
    table: "feed_posts",
  },
  gig_tag: {
    requireNotDeleted: false,
    subjectType: "gig",
    table: "gigs",
  },
  thread_comment_tag: {
    requireNotDeleted: true,
    subjectType: "thread_comment",
    table: "thread_comments",
  },
  thread_tag: {
    requireNotDeleted: false,
    subjectType: "thread_post",
    table: "thread_posts",
  },
} as const;

type TaggedNotificationType = keyof typeof taggedSubjectConfig;
type TaggedSubjectState = "available" | "missing" | "unknown";

function isTaggedNotificationType(
  value: string,
): value is TaggedNotificationType {
  return Object.prototype.hasOwnProperty.call(taggedSubjectConfig, value);
}

async function requireUser() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  return { supabase, userId: claims.sub };
}

async function blockRelationshipExists({
  supabase,
  targetId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  userId: string;
}) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`,
    )
    .limit(1)
    .maybeSingle<{ blocker_id: string }>();

  return Boolean(data);
}

async function taggedNotificationSubjectState({
  notification,
  supabase,
}: {
  notification: NotificationOpenRow;
  supabase: Awaited<ReturnType<typeof createClient>>;
}): Promise<TaggedSubjectState> {
  if (!isTaggedNotificationType(notification.type)) {
    return "available";
  }

  const config = taggedSubjectConfig[notification.type];

  if (
    !notification.subject_id ||
    notification.subject_type !== config.subjectType
  ) {
    return "missing";
  }

  let query = supabase
    .from(config.table)
    .select("id")
    .eq("id", notification.subject_id);

  if (config.requireNotDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query.maybeSingle<{ id: string }>();

  if (error) {
    console.error("Notification subject validation failed.", error);
    return "unknown";
  }

  return data ? "available" : "missing";
}

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notification_id") ?? "");
  const { supabase, userId } = await requireUser();

  if (!notificationId) {
    redirect("/notifications");
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId);

  revalidatePath("/");
  revalidatePath("/notifications");
  redirect("/notifications");
}

export async function openNotification(formData: FormData) {
  const notificationId = String(formData.get("notification_id") ?? "");
  const submittedHref = notificationPathOrFallback(formData.get("href"));
  const { supabase, userId } = await requireUser();

  if (!notificationId) {
    redirect("/notifications");
  }

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .select("href, subject_id, subject_type, type")
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .maybeSingle<NotificationOpenRow>();

  if (notificationError) {
    console.error("Notification open lookup failed.", notificationError);
    redirect("/notifications");
  }

  if (!notification) {
    redirect("/notifications");
  }

  const href = safeNotificationPath(notification.href) ?? submittedHref;
  const subjectState = await taggedNotificationSubjectState({
    notification,
    supabase,
  });

  if (subjectState !== "available") {
    if (subjectState === "missing") {
      const { error: deleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("recipient_id", userId);

      if (deleteError) {
        console.error("Stale notification cleanup failed.", deleteError);
      }
    }

    revalidatePath("/");
    revalidatePath("/notifications");
    redirect("/notifications");
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .is("read_at", null);

  revalidatePath("/");
  revalidatePath("/messages");
  revalidatePath("/notifications");
  redirect(href);
}

export async function respondToFollowRequest(formData: FormData) {
  const decision = String(formData.get("decision") ?? "");
  const followerId = String(formData.get("follower_id") ?? "");
  const notificationId = String(formData.get("notification_id") ?? "");
  const { supabase, userId } = await requireUser();
  const readAt = new Date().toISOString();

  if (
    !followerId ||
    !notificationId ||
    (decision !== "accept" && decision !== "decline")
  ) {
    redirect("/notifications");
  }

  if (decision === "accept") {
    const hasBlockRelationship = await blockRelationshipExists({
      supabase,
      targetId: followerId,
      userId,
    });

    if (!hasBlockRelationship) {
      await supabase
        .from("follows")
        .update({
          responded_at: readAt,
          status: "accepted",
        })
        .eq("follower_id", followerId)
        .eq("following_id", userId)
        .eq("status", "pending");

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle<{ display_name: string; username: string }>();
      const { data: followerPreferences } = await supabase
        .from("profiles")
        .select(notificationPreferenceSelect("follow"))
        .eq("id", followerId)
        .maybeSingle<NotificationPreferenceProfile>();

      if (allowsInAppNotification(followerPreferences, "follow")) {
        await insertNotifications({
          actor_id: userId,
          body: `${ownerProfile?.display_name ?? "A member"} approved your follow request.`,
          href: ownerProfile?.username ? `/u/${ownerProfile.username}` : "/",
          recipient_id: followerId,
          subject_id: userId,
          subject_type: "profile",
          title: "Follow request approved",
          type: "follow_accepted",
        });
      }
    }
  } else if (decision === "decline") {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", userId)
      .eq("status", "pending");
  }

  await supabase
    .from("notifications")
    .update({ read_at: readAt })
    .eq("id", notificationId)
    .eq("recipient_id", userId);

  revalidatePath("/");
  revalidatePath("/notifications");
  redirect("/notifications");
}

export async function markAllNotificationsRead() {
  const { supabase, userId } = await requireUser();

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);

  revalidatePath("/");
  revalidatePath("/notifications");
  redirect("/notifications");
}
