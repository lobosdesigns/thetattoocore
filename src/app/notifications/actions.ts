"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  allowsInAppNotification,
  notificationPreferenceSelect,
  type NotificationPreferenceProfile,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  return { supabase, userId: claims.sub };
}

function safeInternalHref(value: FormDataEntryValue | null) {
  const href = String(value ?? "").trim();

  if (!href.startsWith("/") || href.startsWith("//")) return "/notifications";

  const url = new URL(href, "https://thetattoocore.local");
  const allowedPaths = [
    "/",
    "/account",
    "/messages",
    "/notifications",
    "/saved",
    "/search",
  ];
  const allowedPrefixes = ["/p/", "/t/", "/u/", "/merch/", "/stuff/", "/gigs/"];

  if (
    !allowedPaths.includes(url.pathname) &&
    !allowedPrefixes.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return "/notifications";
  }

  return href;
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
  const href = safeInternalHref(formData.get("href"));
  const { supabase, userId } = await requireUser();

  if (!notificationId) {
    redirect(href);
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
      await supabase.from("notifications").insert({
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
