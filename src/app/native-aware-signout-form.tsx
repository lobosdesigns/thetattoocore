"use client";

import { type FormEvent, useState } from "react";
import { useNativeNotificationSetup } from "./native-notification-provider";

export function NativeAwareSignOutForm() {
  const nativeNotifications = useNativeNotificationSetup();
  const [pending, setPending] = useState(false);

  async function prepareSignOut(event: FormEvent<HTMLFormElement>) {
    if (!nativeNotifications.supported) return;

    event.preventDefault();
    setPending(true);
    const form = event.currentTarget;

    try {
      await nativeNotifications.disable();
    } catch {
      // Server-side sign-out cleanup remains the fallback.
    } finally {
      form.submit();
    }
  }

  return (
    <form action="/auth/signout" method="post" onSubmit={prepareSignOut}>
      <button
        className="ttc-surface h-10 rounded-md border px-4 text-sm font-semibold disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
    </form>
  );
}
