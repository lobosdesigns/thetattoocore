"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Camera,
  MessageCircle,
  Plus,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";

type ComposerMode = "feed" | "threads" | "marketplace" | "gigs" | "messages";

const modes: Record<
  ComposerMode,
  {
    icon: typeof Camera;
    label: string;
    title: string;
  }
> = {
  feed: {
    icon: Camera,
    label: "4U",
    title: "4U post",
  },
  threads: {
    icon: MessageCircle,
    label: "Gossip",
    title: "Gossip",
  },
  marketplace: {
    icon: ShoppingBag,
    label: "Stuff",
    title: "Stuff listing",
  },
  gigs: {
    icon: BriefcaseBusiness,
    label: "Gigs",
    title: "Gig",
  },
  messages: {
    icon: Send,
    label: "DM",
    title: "New DM",
  },
};

function modeFromHash(hash: string): ComposerMode {
  if (hash === "#threads") return "threads";
  if (hash === "#marketplace") return "marketplace";
  if (hash === "#gigs") return "gigs";
  if (hash === "#messages") return "messages";

  return "feed";
}

export function FloatingComposerShell({
  canCreate,
  forms,
  isSignedIn,
}: {
  canCreate: boolean;
  forms: Record<ComposerMode, ReactNode>;
  isSignedIn: boolean;
}) {
  const [activeMode, setActiveMode] = useState<ComposerMode>(() =>
    typeof window === "undefined" ? "feed" : modeFromHash(window.location.hash),
  );
  const [isOpen, setIsOpen] = useState(false);
  const active = modes[activeMode];
  const ActiveIcon = active.icon;

  useEffect(() => {
    const onHashChange = () => setActiveMode(modeFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);

    const sections = ["feed", "threads", "marketplace", "gigs", "messages"]
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveMode(modeFromHash(`#${visible.target.id}`));
        }
      },
      {
        rootMargin: "-35% 0px -50% 0px",
        threshold: [0.05, 0.2, 0.5],
      },
    );

    for (const section of sections) observer.observe(section);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        aria-label={`Create ${active.label}`}
        className="fixed bottom-24 right-5 z-30 flex h-14 max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-md border border-[#3a332d] bg-[#171412] px-3 text-white shadow-[0_14px_34px_rgba(0,0,0,0.34)] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#c8953b]/35 lg:bottom-5"
        onClick={() => setIsOpen(true)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#c8953b] text-[#171412]">
          <ActiveIcon className="size-5" />
        </span>
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d8d1c6]">
            Create
          </span>
          <span className="block truncate text-sm font-bold">{active.label}</span>
        </span>
        <Plus className="size-5 shrink-0" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 bg-[#171412]/55 px-4 py-5 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full max-w-xl items-end sm:items-center">
            <section className="w-full rounded-md border border-[#cfc8bd] bg-[#f2f1ee] shadow-2xl">
              <header className="flex items-center justify-between gap-3 border-b border-[#cfc8bd] bg-[#fffdf9] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#171412] text-[#c8953b]">
                    <ActiveIcon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold">{active.title}</p>
                    <p className="text-xs text-[#766d62]">{active.label}</p>
                  </div>
                </div>
                <button
                  aria-label="Close composer"
                  className="flex size-10 items-center justify-center rounded-md border border-[#cfc8bd] bg-white"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="size-5" />
                </button>
              </header>

              <div className="px-4 py-4">
                {!canCreate ? (
                  <div className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4">
                    <p className="text-sm font-semibold">
                      {isSignedIn
                        ? "Finish your profile to start posting."
                        : "Sign in to post, reply, list, and message."}
                    </p>
                    <Link
                      className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                      href={isSignedIn ? "/account" : "/login"}
                    >
                      {isSignedIn ? "Set up profile" : "Sign in"}
                    </Link>
                  </div>
                ) : (
                  forms[activeMode]
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
