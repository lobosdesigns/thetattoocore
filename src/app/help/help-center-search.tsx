"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { helpArticles, helpCategories } from "@/lib/help-center";

const helpSearchAliases: Record<string, string[]> = {
  appointment: ["appointment", "appointments", "booking", "bookings"],
  appointments: ["appointment", "appointments", "booking", "bookings"],
  booking: ["booking", "bookings", "appointment", "appointments"],
  bookings: ["booking", "bookings", "appointment", "appointments"],
  bank: ["bank", "payout", "payouts", "seller", "payment"],
  chargeback: ["chargeback", "chargebacks", "dispute", "disputes", "refund", "refunds"],
  chargebacks: ["chargeback", "chargebacks", "dispute", "disputes", "refund", "refunds"],
  damaged: ["damaged", "damage", "package", "shipping", "refund", "order"],
  dispute: ["dispute", "disputes", "chargeback", "chargebacks", "refund", "refunds"],
  disputes: ["dispute", "disputes", "chargeback", "chargebacks", "refund", "refunds"],
  dm: ["dm", "dms", "message", "messages", "messenger"],
  dms: ["dm", "dms", "message", "messages", "messenger"],
  convention: ["convention", "conventions", "event", "events", "gig", "gigs"],
  conventions: ["convention", "conventions", "event", "events", "gig", "gigs"],
  event: ["event", "events", "convention", "conventions", "gig", "gigs"],
  events: ["event", "events", "convention", "conventions", "gig", "gigs"],
  gig: ["gig", "gigs", "job", "jobs", "convention", "conventions"],
  gigs: ["gig", "gigs", "job", "jobs", "convention", "conventions"],
  guestspot: ["guest", "guestspot", "guestspots", "spot", "spots", "gig", "gigs"],
  guestspots: ["guest", "guestspot", "guestspots", "spot", "spots", "gig", "gigs"],
  job: ["job", "jobs", "gig", "gigs"],
  jobs: ["job", "jobs", "gig", "gigs"],
  fee: ["fee", "fees", "payment", "payout", "checkout"],
  fees: ["fee", "fees", "payment", "payout", "checkout"],
  merchant: ["merchant", "seller", "sellers", "vendor", "vendors", "payout", "payouts"],
  merchants: ["merchant", "seller", "sellers", "vendor", "vendors", "payout", "payouts"],
  message: ["message", "messages", "dm", "dms", "messenger"],
  messages: ["message", "messages", "dm", "dms", "messenger"],
  payment: ["payment", "payments", "checkout", "payout", "payouts", "fee", "fees"],
  payments: ["payment", "payments", "checkout", "payout", "payouts", "fee", "fees"],
  package: ["package", "packages", "shipping", "tracking", "order", "orders", "refund"],
  packages: ["package", "packages", "shipping", "tracking", "order", "orders", "refund"],
  payout: ["payout", "payouts", "seller", "sellers", "merchant", "payment", "payments"],
  payouts: ["payout", "payouts", "seller", "sellers", "merchant", "payment", "payments"],
  print: ["print", "prints", "art", "merch", "product", "products"],
  prints: ["print", "prints", "art", "merch", "product", "products"],
  product: ["product", "products", "merch"],
  products: ["product", "products", "merch"],
  refund: ["refund", "refunds", "dispute", "disputes", "chargeback", "chargebacks"],
  refunds: ["refund", "refunds", "dispute", "disputes", "chargeback", "chargebacks"],
  seller: ["seller", "sellers", "vendor", "vendors", "merchant", "payout", "payouts"],
  sellers: ["seller", "sellers", "vendor", "vendors", "merchant", "payout", "payouts"],
  shipping: ["shipping", "ship", "tracking", "package", "packages", "order", "orders"],
  shop: ["shop", "shops", "studio", "studios"],
  shops: ["shop", "shops", "studio", "studios"],
  shirt: ["shirt", "shirts", "tshirt", "tshirts", "apparel", "merch"],
  shirts: ["shirt", "shirts", "tshirt", "tshirts", "apparel", "merch"],
  sticker: ["sticker", "stickers", "merch", "product", "products"],
  stickers: ["sticker", "stickers", "merch", "product", "products"],
  studio: ["studio", "studios", "shop", "shops"],
  studios: ["studio", "studios", "shop", "shops"],
  tattooer: ["tattooer", "tattooers", "artist", "artists"],
  tattooers: ["tattooer", "tattooers", "artist", "artists"],
  tshirt: ["shirt", "shirts", "tshirt", "tshirts", "apparel", "merch"],
  tshirts: ["shirt", "shirts", "tshirt", "tshirts", "apparel", "merch"],
  vendor: ["vendor", "vendors", "seller", "sellers"],
  vendors: ["vendor", "vendors", "seller", "sellers"],
  wrong: ["wrong", "item", "package", "order", "refund"],
};

function searchTerms(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9@]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function includesTerm(value: string, term: string) {
  const aliases = helpSearchAliases[term] ?? [term];

  return aliases.some((alias) => value.includes(alias));
}

function matchesSearch(value: string, terms: string[]) {
  const normalizedValue = value.toLowerCase();

  return terms.every((term) => includesTerm(normalizedValue, term));
}

function reviewLabel(lastReviewed: string) {
  return `Last reviewed ${lastReviewed}`;
}

export function HelpCenterSearch() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTerms = useMemo(() => searchTerms(normalizedQuery), [normalizedQuery]);

  const filteredArticles = useMemo(() => {
    if (!normalizedTerms.length) {
      return helpArticles;
    }

    return helpArticles.filter((article) => {
      const haystack = [
        article.category,
        article.description,
        article.lastReviewed,
        article.slug,
        article.title,
        ...(article.keywords ?? []),
        ...article.faqs.flatMap((faq) => [faq.question, faq.answer]),
        ...article.relatedSlugs,
        ...article.steps,
      ].join(" ");

      return matchesSearch(haystack, normalizedTerms);
    });
  }, [normalizedTerms]);

  const filteredCategories = useMemo(() => {
    if (!normalizedTerms.length) {
      return helpCategories;
    }

    return helpCategories.filter((category) => {
      const haystack = [
        category.description,
        category.title,
        ...category.topics,
      ].join(" ");

      return matchesSearch(haystack, normalizedTerms);
    });
  }, [normalizedTerms]);

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
          placeholder="Search getting started, beta app, bookings, ads, Merch..."
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
          These guides cover the first launch support workflows. Articles stay
          public when safe, and account-specific questions stay in private
          support.
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
