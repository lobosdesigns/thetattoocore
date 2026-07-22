import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function cleanReturnTo(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text.startsWith("/") || text.startsWith("//") || text.includes("\\")) return "/account";

  return text;
}

function hasReservedEmailDomain(email: string) {
  const [, domain = ""] = email.split("@");
  const cleanDomain = domain.trim().toLowerCase();

  return (
    !cleanDomain ||
    cleanDomain === "example.com" ||
    cleanDomain === "example.net" ||
    cleanDomain === "example.org" ||
    cleanDomain.endsWith(".example") ||
    cleanDomain.endsWith(".invalid") ||
    cleanDomain === "localhost"
  );
}

function signupRedirect(request: Request, message: string, returnTo = "/account") {
  const url = new URL("/signup", request.url);
  url.searchParams.set("message", message);
  if (returnTo !== "/account") {
    url.searchParams.set("return_to", returnTo);
  }

  return NextResponse.redirect(url, { status: 303 });
}

function signupErrorMessage(error: { code?: string; message?: string; status?: number }) {
  const code = String(error.code ?? "").toLowerCase();
  const message = String(error.message ?? "").toLowerCase();

  if (code.includes("weak_password") || message.includes("password")) {
    return "Use a stronger password with at least 8 characters, then try again.";
  }

  if (code.includes("rate") || error.status === 429 || message.includes("rate")) {
    return "Too many signup attempts right now. Wait a few minutes, then try again.";
  }

  if (
    code.includes("signup_disabled") ||
    message.includes("signup disabled") ||
    message.includes("disabled")
  ) {
    return "New account signup is temporarily unavailable. Use Support or an owner-created tester account.";
  }

  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("confirm")
  ) {
    return "Check inbox and junk for the confirmation email, or sign in if this account already exists.";
  }

  return "Could not create account. Please try again.";
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

  if (hasReservedEmailDomain(email)) {
    return signupRedirect(
      request,
      "Use a real email inbox you can open for confirmation. Testers can also use an owner-created confirmed tester account.",
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
      signupErrorMessage(error),
      returnTo,
    );
  }

  return signupRedirect(
    request,
    "Signup request sent. Check inbox and junk for the confirmation email.",
    returnTo,
  );
}
