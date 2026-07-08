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

  const { error } = await supabase.from("follows").upsert(
    {
      follower_id: userId,
      following_id: targetId,
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
  redirect(profilePath(username, "Following."));
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
