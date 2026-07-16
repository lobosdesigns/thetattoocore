import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function cleanReturnTo(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text.startsWith("/") || text.startsWith("//")) return "/account";

  return text;
}

function signupRedirect(request: Request, message: string, returnTo = "/account") {
  const url = new URL("/signup", request.url);
  url.searchParams.set("message", message);
  if (returnTo !== "/account") {
    url.searchParams.set("return_to", returnTo);
  }

  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ageConfirmed = formData.get("age_confirmed") === "on";
  const returnTo = cleanReturnTo(formData.get("return_to"));

  if (!email || !password) {
    return signupRedirect(
      request,
      "Enter an email and password to create an account.",
      returnTo,
    );
  }

  if (!ageConfirmed) {
    return signupRedirect(
      request,
      "You must confirm you are 18 or older to create an account.",
      returnTo,
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(returnTo)}`,
    },
  });

  if (error) {
    console.error("Signup request failed.", error);
    return signupRedirect(
      request,
      "Could not create account. Please try again.",
      returnTo,
    );
  }

  return signupRedirect(
    request,
    "Signup request sent. Check inbox and junk for the confirmation email.",
    returnTo,
  );
}
