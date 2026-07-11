import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  if (!text.startsWith("/") || text.startsWith("//")) return "/account";

  return text;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();
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
    return loginRedirect(
      request,
      error.message || "Could not sign in.",
      returnTo,
    );
  }

  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
}
