"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function loginMessage(message: string) {
  return `/login?message=${encodeURIComponent(message)}`;
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(loginMessage(error.message || "Could not sign in"));
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ageConfirmed = formData.get("age_confirmed") === "on";
  const requestOrigin = (await headers()).get("origin") ?? siteUrl;

  if (!ageConfirmed) {
    redirect(loginMessage("You must confirm you are 18 or older to create an account."));
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${requestOrigin}/auth/confirm`,
    },
  });

  if (error) {
    redirect(loginMessage(error.message || "Could not create account"));
  }

  revalidatePath("/", "layout");
  redirect(loginMessage("Check your email to confirm your account"));
}
