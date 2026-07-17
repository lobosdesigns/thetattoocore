"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getHelpArticle } from "@/lib/help-center";
import { createClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function safeHelpReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const text = cleanText(value, 160);

  if (text.startsWith("/help/") && !text.startsWith("//")) {
    return text;
  }

  return fallback;
}

function helpMessage(returnPath: string, message: string) {
  const separator = returnPath.includes("?") ? "&" : "?";

  return `${returnPath}${separator}message=${encodeURIComponent(message)}#guide-comments`;
}

function secondsSince(value: string) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 1000);
}

export async function createHelpArticleComment(formData: FormData) {
  const slug = cleanText(formData.get("article_slug"), 120).toLowerCase();
  const article = /^[a-z0-9-]{3,120}$/.test(slug) ? getHelpArticle(slug) : null;
  const returnPath = safeHelpReturnPath(formData.get("return_path"), `/help/${slug}`);
  const body = cleanText(formData.get("body"), 800);

  if (!article) {
    redirect("/help?message=Choose a valid guide.");
  }

  if (body.length < 3) {
    redirect(helpMessage(returnPath, "Add at least 3 characters before submitting."));
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect(`/login?return_to=${encodeURIComponent(returnPath)}`);
  }

  const { data: recentComment } = await supabase
    .from("help_article_comments")
    .select("created_at")
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();

  if (recentComment && secondsSince(recentComment.created_at) < 60) {
    redirect(
      helpMessage(
        returnPath,
        "Please wait a moment before submitting another guide question.",
      ),
    );
  }

  const { error } = await supabase.from("help_article_comments").insert({
    article_slug: article.slug,
    author_id: userId,
    body,
    is_official_answer: false,
    is_pinned: false,
    status: "pending_review",
  });

  if (error) {
    redirect(helpMessage(returnPath, "Question could not be submitted yet."));
  }

  revalidatePath(`/help/${article.slug}`);
  redirect(helpMessage(returnPath, "Question submitted for moderation."));
}
