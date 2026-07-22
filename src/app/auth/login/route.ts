import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authSessionPreferenceCookie,
  authSessionPreferenceCookieOptions,
  authSessionPreferenceValue,
} from "@/lib/auth-session";

function loginRedirect(request: Request, message: string, returnTo?: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("message", message);
  if (returnTo && returnTo !== "/account") {
    url.searchParams.set("return_to", returnTo);
  }

  return NextResponse.redirect(url, { status: 303 });
}

function cleanReturnTo(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (
    !text.startsWith("/") ||
    text.startsWith("//") ||
    text.includes("\\") ||
    text.startsWith("/login")
  ) {
    return "/account";
  }

  return text;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const staySignedIn = formData.get("stay_signed_in") === "on";
  const supabase = await createClient({ persistentSession: staySignedIn });
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnTo = cleanReturnTo(formData.get("return_to"));

  if (!email || !password) {
    return loginRedirect(request, "Enter your email and password.", returnTo);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Signin request failed.", error);
    return loginRedirect(
      request,
      "Could not sign in. Check your email and password, then try again.",
      returnTo,
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(
    authSessionPreferenceCookie,
    authSessionPreferenceValue(staySignedIn),
    authSessionPreferenceCookieOptions(
      staySignedIn,
      process.env.NODE_ENV === "production",
    ),
  );

  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
}
