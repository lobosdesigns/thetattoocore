"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ColumnId =
  | "feed"
  | "threads"
  | "marketplace"
  | "gigs"
  | "merch"
  | "messages";

const tabs: { href: string; id?: ColumnId; label: string }[] = [
  { href: "#feed", id: "feed", label: "4U" },
  { href: "#threads", id: "threads", label: "Gossip" },
  { href: "#marketplace", id: "marketplace", label: "Stuff" },
  { href: "#gigs", id: "gigs", label: "Gigs" },
  { href: "#merch", id: "merch", label: "Merch" },
  { href: "#messages", id: "messages", label: "DM" },
];

function idFromHash(hash: string): ColumnId {
  if (hash === "#threads") return "threads";
  if (hash === "#marketplace") return "marketplace";
  if (hash === "#gigs") return "gigs";
  if (hash === "#merch") return "merch";
  if (hash === "#messages") return "messages";

  return "feed";
}

export function ColumnTabs({ unreadDmCount = 0 }: { unreadDmCount?: number }) {
  const [activeId, setActiveId] = useState<ColumnId>(() =>
    typeof window === "undefined" ? "feed" : idFromHash(window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () => setActiveId(idFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);

    const sections = tabs
      .map((tab) => (tab.id ? document.getElementById(tab.id) : null))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveId(visible.target.id as ColumnId);
        }
      },
      {
        rootMargin: "0px -45% 0px -45%",
        threshold: [0.15, 0.35, 0.55],
      },
    );

    for (const section of sections) observer.observe(section);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      observer.disconnect();
    };
  }, []);

  return (
    <nav
      aria-label="Main columns"
      className="flex gap-2 overflow-x-auto border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_90%,var(--background))] px-4 py-3 shadow-[inset_0_-1px_0_rgba(23,20,18,0.04)]"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-md border px-4 text-sm font-medium transition ${
              isActive
                ? "ttc-control-active shadow-[0_6px_16px_rgba(23,20,18,0.16)]"
                : "ttc-surface hover:border-[var(--accent)]"
            }`}
            href={tab.href}
            key={tab.label}
            onClick={() => {
              if (tab.id) setActiveId(tab.id);
            }}
          >
            {tab.label}
            {tab.label === "DM" && unreadDmCount ? (
              <span
                className={`ml-2 flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                  isActive
                    ? "bg-[var(--background)] text-[var(--foreground)]"
                    : "bg-[var(--foreground)] text-[var(--background)]"
                }`}
              >
                {unreadDmCount > 9 ? "9+" : unreadDmCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
