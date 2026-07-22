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
  const nativeDevice = parseNativePushCookie(
    request.cookies.get(nativePushDeviceCookie)?.value,
  );
  const webSubscriptionId = request.cookies.get(
    webPushSubscriptionCookie,
  )?.value;
  const hasDeviceRegistration =
    Boolean(nativeDevice) || validDeviceAlertUuid(webSubscriptionId);

  if (userId && hasDeviceRegistration) {
    if (!admin) {
      return NextResponse.redirect(
        new URL(
          "/account?message=Sign-out%20could%20not%20be%20completed.%20Please%20try%20again.",
          request.url,
        ),
        { status: 303 },
      );
    }

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

    const removalResults = await Promise.all(removals);

    if (removalResults.some((result) => result.error)) {
      console.error("Sign-out device alert cleanup failed.");
      return NextResponse.redirect(
        new URL(
          "/account?message=Sign-out%20could%20not%20be%20completed.%20Please%20try%20again.",
          request.url,
        ),
        { status: 303 },
      );
    }
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
