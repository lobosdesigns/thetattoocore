"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
