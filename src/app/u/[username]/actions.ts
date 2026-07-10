"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

function profilePath(username: string, message?: string) {
  const params = new URLSearchParams();

  if (message) params.set("message", message);

  return `/u/${username}${params.toString() ? `?${params.toString()}` : ""}`;
}

function cleanUsername(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .slice(0, 30);
}

async function requireUser() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, banned_at, suspended_at")
    .eq("id", claims.sub)
    .maybeSingle<{
      banned_at: string | null;
      id: string;
      suspended_at: string | null;
    }>();

  if (!profile) {
    redirect("/account");
  }

  if (profile.banned_at) {
    redirect("/");
  }

  if (profile.suspended_at) {
    redirect("/");
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

export async function followProfile(formData: FormData) {
  const username = cleanUsername(formData.get("username"));
  const targetId = String(formData.get("profile_id") ?? "");
  const { supabase, userId } = await requireUser();

  if (!username || !targetId) {
    redirect("/");
  }

  if (targetId === userId) {
    redirect(profilePath(username, "You cannot follow yourself."));
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle<{ display_name: string; username: string }>();

  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, is_private, username")
    .eq("id", targetId)
    .maybeSingle<{ id: string; is_private: boolean; username: string }>();

  if (targetError || !targetProfile) {
    redirect(profilePath(username, targetError?.message || "Profile not found."));
  }

  if (await blockRelationshipExists({ supabase, targetId, userId })) {
    redirect(profilePath(username, "You cannot follow a blocked profile."));
  }

  const status = targetProfile.is_private ? "pending" : "accepted";
  const { error } = await supabase.from("follows").upsert(
    {
      follower_id: userId,
      following_id: targetId,
      status,
    },
    {
      ignoreDuplicates: true,
      onConflict: "follower_id,following_id",
    },
  );

  if (error) {
    redirect(profilePath(username, error.message || "Could not follow profile."));
  }

  if (status === "pending") {
    const { data: targetPreferences } = await supabase
      .from("profiles")
      .select("notify_follow_activity")
      .eq("id", targetId)
      .maybeSingle<{ notify_follow_activity: boolean }>();

    if (targetPreferences?.notify_follow_activity !== false) {
      await supabase.from("notifications").insert({
        actor_id: userId,
        body: `${actorProfile?.display_name ?? "A member"} wants to follow your private profile.`,
        href: `/u/${targetProfile.username}`,
        recipient_id: targetId,
        subject_id: userId,
        subject_type: "profile",
        title: "New follow request",
        type: "follow_request",
      });
    }
  }

  revalidatePath(`/u/${username}`);
  redirect(
    profilePath(
      username,
      status === "pending" ? "Follow request sent." : "Following.",
    ),
  );
}

export async function unfollowProfile(formData: FormData) {
  const username = cleanUsername(formData.get("username"));
  const targetId = String(formData.get("profile_id") ?? "");
  const { supabase, userId } = await requireUser();

  if (!username || !targetId) {
    redirect("/");
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", userId)
    .eq("following_id", targetId);

  if (error) {
    redirect(profilePath(username, error.message || "Could not unfollow profile."));
  }

  revalidatePath(`/u/${username}`);
  redirect(profilePath(username, "Unfollowed."));
}

export async function acceptFollowRequest(formData: FormData) {
  const username = cleanUsername(formData.get("username"));
  const followerId = String(formData.get("follower_id") ?? "");
  const { supabase, userId } = await requireUser();

  if (!username || !followerId) {
    redirect("/");
  }

  const { error } = await supabase
    .from("follows")
    .update({
      responded_at: new Date().toISOString(),
      status: "accepted",
    })
    .eq("follower_id", followerId)
    .eq("following_id", userId)
    .eq("status", "pending");

  if (error) {
    redirect(profilePath(username, error.message || "Could not approve request."));
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle<{ display_name: string; username: string }>();

  const { data: followerPreferences } = await supabase
    .from("profiles")
    .select("notify_follow_activity")
    .eq("id", followerId)
    .maybeSingle<{ notify_follow_activity: boolean }>();

  if (followerPreferences?.notify_follow_activity !== false) {
    await supabase.from("notifications").insert({
      actor_id: userId,
      body: `${ownerProfile?.display_name ?? "A member"} approved your follow request.`,
      href: `/u/${ownerProfile?.username ?? username}`,
      recipient_id: followerId,
      subject_id: userId,
      subject_type: "profile",
      title: "Follow request approved",
      type: "follow_accepted",
    });
  }

  revalidatePath(`/u/${username}`);
  redirect(profilePath(username, "Follow request approved."));
}

export async function declineFollowRequest(formData: FormData) {
  const username = cleanUsername(formData.get("username"));
  const followerId = String(formData.get("follower_id") ?? "");
  const { supabase, userId } = await requireUser();

  if (!username || !followerId) {
    redirect("/");
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", userId)
    .eq("status", "pending");

  if (error) {
    redirect(profilePath(username, error.message || "Could not decline request."));
  }

  revalidatePath(`/u/${username}`);
  redirect(profilePath(username, "Follow request declined."));
}

export async function blockProfile(formData: FormData) {
  const username = cleanUsername(formData.get("username"));
  const targetId = String(formData.get("profile_id") ?? "");
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 500);
  const { supabase, userId } = await requireUser();

  if (!username || !targetId) {
    redirect("/");
  }

  if (targetId === userId) {
    redirect(profilePath(username, "You cannot block yourself."));
  }

  const { error } = await supabase.from("user_blocks").upsert(
    {
      blocked_id: targetId,
      blocker_id: userId,
      reason: reason || null,
    },
    {
      ignoreDuplicates: true,
      onConflict: "blocker_id,blocked_id",
    },
  );

  if (error) {
    redirect(profilePath(username, error.message || "Could not block profile."));
  }

  await supabase
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${userId},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${userId})`,
    );

  revalidatePath(`/u/${username}`);
  redirect(profilePath(username, "Profile blocked."));
}

export async function unblockProfile(formData: FormData) {
  const username = cleanUsername(formData.get("username"));
  const targetId = String(formData.get("profile_id") ?? "");
  const { supabase, userId } = await requireUser();

  if (!username || !targetId) {
    redirect("/");
  }

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId);

  if (error) {
    redirect(profilePath(username, error.message || "Could not unblock profile."));
  }

  revalidatePath(`/u/${username}`);
  redirect(profilePath(username, "Profile unblocked."));
}
