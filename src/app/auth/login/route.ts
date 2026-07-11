import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("message", message);

  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return loginRedirect(request, "Enter your email and password.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return loginRedirect(request, error.message || "Could not sign in.");
  }

  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL("/account", request.url), { status: 303 });
}
