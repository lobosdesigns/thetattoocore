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
    .select("id")
    .eq("id", claims.sub)
    .maybeSingle<{ id: string }>();

  if (!profile) {
    redirect("/account");
  }

  return { supabase, userId: claims.sub };
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

  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, is_private")
    .eq("id", targetId)
    .maybeSingle<{ id: string; is_private: boolean }>();

  if (targetError || !targetProfile) {
    redirect(profilePath(username, targetError?.message || "Profile not found."));
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
