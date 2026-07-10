export type NotificationPreferenceCategory =
  | "feed"
  | "follow"
  | "marketplace_gig"
  | "message"
  | "thread";

export type NotificationPreferenceProfile = {
  id?: string;
  notification_quiet_hours_enabled?: boolean | null;
  notification_quiet_hours_end?: string | null;
  notification_quiet_hours_start?: string | null;
  notification_timezone?: string | null;
  notify_feed_activity?: boolean | null;
  notify_follow_activity?: boolean | null;
  notify_marketplace_gig_activity?: boolean | null;
  notify_message_activity?: boolean | null;
  notify_thread_activity?: boolean | null;
};

const PREFERENCE_COLUMNS: Record<NotificationPreferenceCategory, string> = {
  feed: "notify_feed_activity",
  follow: "notify_follow_activity",
  marketplace_gig: "notify_marketplace_gig_activity",
  message: "notify_message_activity",
  thread: "notify_thread_activity",
};

export function notificationPreferenceColumn(
  category: NotificationPreferenceCategory,
) {
  return PREFERENCE_COLUMNS[category];
}

export function notificationPreferenceSelect(
  category: NotificationPreferenceCategory,
  includeQuietHours = false,
) {
  const column = notificationPreferenceColumn(category);

  if (!includeQuietHours) return column;

  return [
    column,
    "notification_quiet_hours_enabled",
    "notification_quiet_hours_start",
    "notification_quiet_hours_end",
    "notification_timezone",
  ].join(", ");
}

export function allowsInAppNotification(
  profile: NotificationPreferenceProfile | null | undefined,
  category: NotificationPreferenceCategory,
) {
  const column = notificationPreferenceColumn(category);

  return profile?.[column as keyof NotificationPreferenceProfile] !== false;
}

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function minutesInTimezone(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      timeZone,
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

    return (hour % 24) * 60 + minute;
  } catch {
    return null;
  }
}

export function isNotificationQuietHour(
  profile: NotificationPreferenceProfile | null | undefined,
  now = new Date(),
) {
  if (!profile?.notification_quiet_hours_enabled) return false;

  const start = parseTimeToMinutes(profile.notification_quiet_hours_start);
  const end = parseTimeToMinutes(profile.notification_quiet_hours_end);
  const current = minutesInTimezone(
    now,
    profile.notification_timezone || "America/Chicago",
  );

  if (start === null || end === null || current === null || start === end) {
    return false;
  }

  if (start < end) return current >= start && current < end;

  return current >= start || current < end;
}

export function allowsNoisyDeliveryNow(
  profile: NotificationPreferenceProfile | null | undefined,
  category: NotificationPreferenceCategory,
  now = new Date(),
) {
  return (
    allowsInAppNotification(profile, category) &&
    !isNotificationQuietHour(profile, now)
  );
}
