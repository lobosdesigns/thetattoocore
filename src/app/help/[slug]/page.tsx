import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogoLockup } from "../../logo-mark";
import { getHelpArticle, helpArticles } from "@/lib/help-center";
import { siteName, supportEmail } from "@/lib/site";

type HelpArticlePageProps = {
  params: Promise<{ slug: string }>;
};

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

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = getHelpArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="ttc-page min-h-screen px-4 py-8">
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
            <h2 className="text-lg font-bold">Screenshots And Tutorials</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Screenshots and short clips will be added as each workflow is
              finalized. Guides will avoid private messages, license documents,
              real payment data, and personal contact details.
            </p>
          </section>

          <section className="ttc-surface mt-7 rounded-lg border border-[var(--card-rim)] p-4">
            <h2 className="text-lg font-bold">Guide Comments</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Signed-in member comments are planned for deeper questions on each
              guide. Moderators will be able to answer, pin official replies,
              hide unsafe comments, and turn repeated questions into FAQ
              updates.
            </p>
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
