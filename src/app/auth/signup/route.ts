import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("message", message);

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
  const origin = request.headers.get("origin") ?? siteUrl;

  if (!email || !password) {
    return loginRedirect(request, "Enter an email and password to create an account.");
  }

  if (!ageConfirmed) {
    return loginRedirect(
      request,
      "You must confirm you are 18 or older to create an account.",
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    return loginRedirect(request, error.message || "Could not create account.");
  }

  return loginRedirect(
    request,
    "Signup request sent. Check inbox and junk for the confirmation email.",
  );
}
