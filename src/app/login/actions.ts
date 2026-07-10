"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
