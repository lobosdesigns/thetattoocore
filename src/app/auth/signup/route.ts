import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function signupRedirect(request: Request, message: string) {
  const url = new URL("/signup", request.url);
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

  if (!email || !password) {
    return signupRedirect(request, "Enter an email and password to create an account.");
  }

  if (!ageConfirmed) {
    return signupRedirect(
      request,
      "You must confirm you are 18 or older to create an account.",
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    return signupRedirect(request, error.message || "Could not create account.");
  }

  return signupRedirect(
    request,
    "Signup request sent. Check inbox and junk for the confirmation email.",
  );
}
