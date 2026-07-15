"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { helpArticles, helpCategories } from "@/lib/help-center";

function includesTerm(value: string, term: string) {
  return value.toLowerCase().includes(term);
}

function reviewLabel(lastReviewed: string) {
  return `Last reviewed ${lastReviewed}`;
}

export function HelpCenterSearch() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredArticles = useMemo(() => {
    if (!normalizedQuery) {
      return helpArticles;
    }

    return helpArticles.filter((article) => {
      const haystack = [
        article.category,
        article.description,
        article.lastReviewed,
        article.title,
        ...article.faqs.flatMap((faq) => [faq.question, faq.answer]),
        ...article.steps,
      ].join(" ");

      return includesTerm(haystack, normalizedQuery);
    });
  }, [normalizedQuery]);

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) {
      return helpCategories;
    }

    return helpCategories.filter((category) => {
      const haystack = [
        category.description,
        category.title,
        ...category.topics,
      ].join(" ");

      return includesTerm(haystack, normalizedQuery);
    });
  }, [normalizedQuery]);

  return (
    <>
      <div className="ttc-surface mt-7 flex items-center gap-3 rounded-lg border border-[var(--card-rim)] px-3 py-2">
        <Search aria-hidden="true" className="size-5 shrink-0 text-[var(--muted-strong)]" />
        <label className="sr-only" htmlFor="help-search">
          Search Help Center
        </label>
        <input
          className="min-h-11 flex-1 border-0 bg-transparent text-base font-semibold outline-none placeholder:text-[var(--muted)]"
          id="help-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search bookings, ads, Merch, verification..."
          type="search"
          value={query}
        />
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {filteredCategories.map((category) => (
          <section
            className="ttc-surface rounded-lg border border-[var(--card-rim)] p-4"
            key={category.title}
          >
            <h2 className="text-lg font-bold">{category.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {category.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {category.topics.map((topic) => (
                <span
                  className="rounded-full border border-[var(--card-rim)] px-3 py-1 text-xs font-semibold text-[var(--muted-strong)]"
                  key={topic}
                >
                  {topic}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-7 rounded-lg border border-[var(--card-rim)] p-4">
        <h2 className="text-lg font-bold">Tutorial Library</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          These are the first screenshot tutorials planned for launch support.
          Articles will be public when safe, and account-specific questions will
          stay in private support.
        </p>
        <ul className="mt-4 grid gap-2 text-sm leading-6 text-[var(--muted)] md:grid-cols-2">
          {filteredArticles.map((article) => (
            <li
              className="rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] px-3 py-2"
              key={article.slug}
            >
              <Link className="font-semibold underline" href={`/help/${article.slug}`}>
                {article.title}
              </Link>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {article.category}
              </span>
              <span className="mt-1 block text-xs font-semibold text-[var(--muted-strong)]">
                {reviewLabel(article.lastReviewed)}
              </span>
            </li>
          ))}
        </ul>
        {filteredArticles.length === 0 ? (
          <p className="mt-4 rounded-md border border-[var(--card-rim)] bg-[var(--surface-subtle)] p-3 text-sm leading-6 text-[var(--muted)]">
            No guide matched that search. Contact support with the feature name
            and where you got stuck.
          </p>
        ) : null}
      </section>
    </>
  );
}
