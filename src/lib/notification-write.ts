import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type NotificationInsert = {
  actor_id: string | null;
  body?: string | null;
  href?: string | null;
  message_id?: string | null;
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

  const notifications = Array.isArray(rows) ? rows : [rows];

  if (notifications.length === 0) return { error: null };

  const enqueueNative =
    process.env.TTC_DEVICE_ALERT_SETUP_ENABLED === "true" &&
    process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED === "true" &&
    process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED === "true";
  const { error } = await admin.rpc(
    "insert_notifications_with_native_delivery",
    {
      p_enqueue_native: enqueueNative,
      p_notifications: notifications,
    },
  );

  return { error };
}
