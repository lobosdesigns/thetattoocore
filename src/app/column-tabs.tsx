"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ColumnId = "feed" | "threads" | "marketplace" | "gigs";

const tabs: { href: string; id?: ColumnId; label: string }[] = [
  { href: "#feed", id: "feed", label: "4U" },
  { href: "#threads", id: "threads", label: "Gossip" },
  { href: "#marketplace", id: "marketplace", label: "Stuff" },
  { href: "#gigs", id: "gigs", label: "Gigs" },
  { href: "/messages", label: "DM" },
];

function idFromHash(hash: string): ColumnId {
  if (hash === "#threads") return "threads";
  if (hash === "#marketplace") return "marketplace";
  if (hash === "#gigs") return "gigs";

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
      className="flex gap-2 overflow-x-auto border-b border-[#e5ded4] px-4 py-3"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-md border px-4 text-sm font-medium transition ${
              isActive
                ? "border-[#171412] bg-[#171412] text-white shadow-sm"
                : "border-[#d8d1c6] bg-white text-[#171412]"
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
                    ? "bg-white text-[#171412]"
                    : "bg-[#171412] text-white"
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
