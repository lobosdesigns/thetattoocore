import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createHelpArticleComment } from "../actions";
import { ContentReportForm } from "@/app/content-report-form";
import { LogoLockup } from "../../logo-mark";
import { getHelpArticle, helpArticles } from "@/lib/help-center";
import { siteName, supportEmail } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

type HelpArticlePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ comments?: string; message?: string }>;
};

const commentPageSize = 25;

function reviewLabel(lastReviewed: string) {
  return `Last reviewed ${lastReviewed}`;
}

type HelpArticleComment = {
  body: string;
  created_at: string;
  id: string;
  is_official_answer: boolean;
  is_pinned: boolean;
  status: string;
  profiles: {
    avatar_url: string | null;
    display_name: string | null;
    username: string | null;
  } | null;
};

type HelpArticleCommentRow = Omit<HelpArticleComment, "profiles"> & {
  profiles:
    | HelpArticleComment["profiles"]
    | HelpArticleComment["profiles"][];
};

function normalizeComment(row: HelpArticleCommentRow): HelpArticleComment {
  return {
    ...row,
    profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles,
  };
}

function displayCommentAuthor(comment: HelpArticleComment) {
  return (
    comment.profiles?.display_name ||
    comment.profiles?.username ||
    "TheTattooCore member"
  );
}

function commentDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function commentLimit(value?: string) {
  const parsed = Number.parseInt(value ?? "25", 10);
  const safeLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : commentPageSize;

  return Math.min(Math.max(commentPageSize, safeLimit), 250);
}

function commentsHref(slug: string, limit: number) {
  return `/help/${slug}?comments=${limit}#guide-comments`;
}

export function generateStaticParams() {
  return helpArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: HelpArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);

  if (!article) {
    return {
      title: "Help Center",
    };
  }

  return {
    description: article.description,
    title: `${article.title} | Help Center`,
  };
}

export default async function HelpArticlePage({
  params,
  searchParams,
}: HelpArticlePageProps) {
  const { slug } = await params;
  const { comments: commentsParam, message } = (await searchParams) ?? {};
  const article = getHelpArticle(slug);

  if (!article) {
    notFound();
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(claimsData?.claims?.sub);
  const visibleCommentLimit = commentLimit(commentsParam);
  const commentFetchLimit = visibleCommentLimit + commentPageSize;
  const { data: commentRows, error: commentError } = await supabase
    .from("help_article_comments")
    .select(
      "id, body, status, is_official_answer, is_pinned, created_at, profiles:profiles!help_article_comments_author_id_fkey(username, display_name, avatar_url)",
    )
    .eq("article_slug", article.slug)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(commentFetchLimit);
  const allComments = commentError
    ? []
    : ((commentRows ?? []) as unknown as HelpArticleCommentRow[]).map(
        normalizeComment,
      );
  const comments = allComments.slice(0, visibleCommentLimit);
  const hasMoreComments = allComments.length > visibleCommentLimit;

  const relatedArticles = article.relatedSlugs
    .map((relatedSlug) => getHelpArticle(relatedSlug))
    .filter((relatedArticle) => relatedArticle !== null);
  const tutorialMedia = article.tutorialMedia ?? [];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faqs.map((faq) => ({
      "@type": "Question",
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
      name: faq.question,
    })),
  };

  return (
    <main className="ttc-page min-h-screen px-4 py-8">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        type="application/ld+json"
      />
      <article className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label={`${siteName} home`}>
            <LogoLockup />
          </Link>
          <Link
            className="ttc-surface rounded-md border px-4 py-2 text-sm font-semibold"
            href="/help"
          >
            Help Center
          </Link>
        </div>

        <section className="ttc-card ttc-page-panel rounded-lg border border-[var(--card-rim)] p-5 sm:p-7">
          <p className="text-sm font-semibold uppercase text-[var(--muted-strong)]">
            {article.category}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{article.title}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {article.description}
          </p>
          <p className="mt-3 inline-flex rounded-full border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--muted-strong)]">
            {reviewLabel(article.lastReviewed)}
          </p>

          <section className="mt-7">
            <h2 className="text-lg font-bold">Steps</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
              {article.steps.map((step, index) => (
                <li
                  className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3"
                  key={step}
                >
                  <span className="mr-2 font-bold text-[var(--text)]">
                    {index + 1}.
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="ttc-surface mt-7 rounded-lg border border-[var(--card-rim)] p-4">
            <h2 className="text-lg font-bold">FAQ</h2>
            <div className="mt-4 space-y-3">
              {article.faqs.map((faq) => (
                <details
                  className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3"
                  key={faq.question}
                >
                  <summary className="cursor-pointer text-sm font-bold text-[var(--text)]">
                    {faq.question}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section className="ttc-surface mt-7 rounded-lg border border-[var(--card-rim)] p-4">
            <h2 className="text-lg font-bold">Related Guides</h2>
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-[var(--muted)] sm:grid-cols-2">
              {relatedArticles.map((relatedArticle) => (
                <li
                  className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-3 py-2"
                  key={relatedArticle.slug}
                >
                  <Link
                    className="font-semibold underline"
                    href={`/help/${relatedArticle.slug}`}
                  >
                    {relatedArticle.title}
                  </Link>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {relatedArticle.category}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[var(--muted-strong)]">
                    {reviewLabel(relatedArticle.lastReviewed)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ttc-surface mt-7 rounded-lg border border-[var(--card-rim)] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gold)]">
                  Safe capture plan
                </p>
                <h2 className="mt-1 text-lg font-bold">Screenshots And Tutorials</h2>
              </div>
              {tutorialMedia.length ? (
                <span className="w-fit rounded-full border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-bold text-[var(--muted-strong)]">
                  {tutorialMedia.length} planned
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Visual walkthroughs avoid private messages, license documents,
              real payment data, and personal contact details. Use the written
              steps and FAQ first, then ask a guide question if a workflow still
              needs a clearer example.
            </p>
            {tutorialMedia.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {tutorialMedia.map((item) => {
                  const assetSrc =
                    "assetSrc" in item && typeof item.assetSrc === "string"
                      ? item.assetSrc
                      : null;

                  return (
                    <article
                      className="overflow-hidden rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)]"
                      key={`${item.kind}-${item.title}`}
                    >
                      {item.kind === "screenshot" && assetSrc ? (
                        <div className="border-b border-[var(--card-rim)] bg-[var(--paper)] p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={`${item.title} safe tutorial screenshot`}
                            className="mx-auto aspect-[9/16] max-h-72 w-auto rounded-md border border-[var(--card-rim)] object-cover shadow-sm"
                            loading="lazy"
                            src={assetSrc}
                          />
                        </div>
                      ) : null}
                      {item.kind === "short_clip" && assetSrc ? (
                        <div className="border-b border-[var(--card-rim)] bg-black p-3">
                          <video
                            aria-label={`${item.title} safe tutorial short video`}
                            className="mx-auto aspect-[9/16] max-h-72 w-auto rounded-md border border-[var(--card-rim)] bg-black object-cover shadow-sm"
                            controls
                            controlsList="nodownload"
                            playsInline
                            preload="metadata"
                            src={assetSrc}
                          />
                        </div>
                      ) : null}
                      <div className="p-3">
                        <p className="text-xs font-bold uppercase text-[var(--muted-strong)]">
                          {item.kind === "short_clip" ? "Short video" : "Screenshot"}
                        </p>
                        <h3 className="mt-1 text-sm font-bold text-[var(--text)]">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {item.description}
                        </p>
                        <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[var(--background)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--muted-strong)]">
                          Capture with safe sample content only.
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3 text-sm leading-6 text-[var(--muted)]">
                No visual walkthrough is queued for this guide yet. Use the
                written steps and guide questions for now.
              </p>
            )}
          </section>

          <section
            className="ttc-surface mt-7 rounded-lg border border-[var(--card-rim)] p-4"
            id="guide-comments"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Guide Questions</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Ask deeper workflow questions here. Moderators can approve,
                  answer, pin official replies, hide unsafe comments, and turn
                  repeated questions into FAQ updates.
                </p>
              </div>
              <span className="rounded-full border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-bold text-[var(--muted-strong)]">
                {comments.length} shown
              </span>
            </div>

            {message ? (
              <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
                {message}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {comments.length ? (
                comments.map((comment) => (
                  <article
                    className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3"
                    key={comment.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--text)]">
                          {displayCommentAuthor(comment)}
                        </p>
                        <p className="text-xs font-semibold text-[var(--muted)]">
                          {commentDate(comment.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {comment.is_pinned ? (
                          <span className="rounded-full border border-[var(--accent)] px-2 py-1 text-xs font-bold text-[var(--accent)]">
                            Pinned
                          </span>
                        ) : null}
                        {comment.is_official_answer ? (
                          <span className="rounded-full border border-[var(--accent)] px-2 py-1 text-xs font-bold text-[var(--accent)]">
                            Official
                          </span>
                        ) : null}
                        {comment.status !== "visible" ? (
                          <span className="rounded-full border border-[var(--card-rim)] px-2 py-1 text-xs font-bold text-[var(--muted-strong)]">
                            Pending
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                      {comment.body}
                    </p>
                    {comment.status === "visible" ? (
                      <div className="mt-3">
                        <ContentReportForm
                          returnHash="guide-comments"
                          returnPath={`/help/${article.slug}`}
                          subjectId={comment.id}
                          subjectType="help_article_comment"
                        />
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3 text-sm leading-6 text-[var(--muted)]">
                  No approved questions yet. Be the first to ask something
                  useful for the community.
                </p>
              )}
            </div>

            {hasMoreComments ? (
              <Link
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-4 text-sm font-bold text-[var(--text)] sm:w-auto"
                href={commentsHref(article.slug, visibleCommentLimit + commentPageSize)}
              >
                Load more questions
              </Link>
            ) : null}

            {isSignedIn ? (
              <form action={createHelpArticleComment} className="mt-4 space-y-3">
                <input name="article_slug" type="hidden" value={article.slug} />
                <input
                  name="return_path"
                  type="hidden"
                  value={`/help/${article.slug}`}
                />
                <label
                  className="block text-sm font-bold text-[var(--text)]"
                  htmlFor="help-question"
                >
                  Ask a question
                </label>
                <textarea
                  className="min-h-28 w-full rounded-md border border-[var(--card-rim)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  id="help-question"
                  maxLength={800}
                  minLength={3}
                  name="body"
                  placeholder="Ask about this guide, a setup step, or a workflow detail."
                  required
                />
                <button
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--button-bg)] px-4 text-sm font-bold text-[var(--button-text)]"
                  type="submit"
                >
                  Submit question
                </button>
              </form>
            ) : (
              <div className="mt-4 rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3 text-sm leading-6 text-[var(--muted)]">
                <Link
                  className="font-bold text-[var(--text)] underline"
                  href={`/login?return_to=${encodeURIComponent(`/help/${article.slug}`)}`}
                >
                  Sign in
                </Link>{" "}
                to ask a question on this guide.
              </div>
            )}
          </section>

          <div className="mt-7 flex flex-col gap-3 text-sm font-semibold sm:flex-row">
            <Link
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4"
              href="/help"
            >
              All guides
            </Link>
            <a
              className="ttc-surface inline-flex h-10 items-center justify-center rounded-md border px-4"
              href={`mailto:${supportEmail}`}
            >
              {supportEmail}
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}
