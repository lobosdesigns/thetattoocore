import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import {
  deviceAlertCookieOptions,
  nativePushDeviceCookie,
  parseNativePushCookie,
  validDeviceAlertUuid,
  webPushSubscriptionCookie,
} from "@/lib/device-alert-cookies";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const admin = createAdminClient();

  if (userId && admin) {
    const nativeDevice = parseNativePushCookie(
      request.cookies.get(nativePushDeviceCookie)?.value,
    );
    const webSubscriptionId = request.cookies.get(
      webPushSubscriptionCookie,
    )?.value;
    const removals = [];

    if (nativeDevice) {
      removals.push(
        admin
          .from("native_push_devices")
          .delete()
          .eq("profile_id", userId)
          .eq("platform", nativeDevice.platform)
          .eq("installation_id", nativeDevice.installationId),
      );
    }

    if (validDeviceAlertUuid(webSubscriptionId)) {
      removals.push(
        admin
          .from("push_subscriptions")
          .delete()
          .eq("profile_id", userId)
          .eq("id", webSubscriptionId),
      );
    }

    await Promise.all(removals);
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 302,
  });
  const expiredCookie = { ...deviceAlertCookieOptions, maxAge: 0 };
  response.cookies.set(nativePushDeviceCookie, "", expiredCookie);
  response.cookies.set(webPushSubscriptionCookie, "", expiredCookie);

  return response;
}
