import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type NotificationInsert = {
  actor_id: string | null;
  body?: string | null;
  href?: string | null;
  recipient_id: string;
  subject_id?: string | null;
  subject_type: string;
  title: string;
  type: string;
};

export async function insertNotifications(
  rows: NotificationInsert | NotificationInsert[],
) {
  const admin = createAdminClient();

  if (!admin) {
    return { error: new Error("Notification writer is unavailable.") };
  }

  const { error } = await admin.from("notifications").insert(rows);

  return { error };
}
