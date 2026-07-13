"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Camera,
  MessageCircle,
  Package,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";

type ComposerMode =
  | "feed"
  | "stories"
  | "threads"
  | "marketplace"
  | "gigs"
  | "merch"
  | "messages";

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
  stories: {
    icon: Sparkles,
    label: "Story",
    title: "Story",
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
  merch: {
    icon: Package,
    label: "Merch",
    title: "Merch item",
  },
  messages: {
    icon: Send,
    label: "DM",
    title: "New DM",
  },
};

function modeFromHash(hash: string): ComposerMode {
  if (hash === "#stories") return "stories";
  if (hash === "#threads") return "threads";
  if (hash === "#marketplace") return "marketplace";
  if (hash === "#gigs") return "gigs";
  if (hash === "#merch") return "merch";
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
  const [activeMode, setActiveMode] = useState<ComposerMode>("feed");
  const [isOpen, setIsOpen] = useState(false);
  const active = modes[activeMode];
  const ActiveIcon = active.icon;

  useEffect(() => {
    const onHashChange = () => setActiveMode(modeFromHash(window.location.hash));
    onHashChange();
    window.addEventListener("hashchange", onHashChange);

    const composeMode = new URLSearchParams(window.location.search).get(
      "compose",
    );
    const composeOpenTimer =
      composeMode && composeMode in modes
        ? window.setTimeout(() => {
            setActiveMode(composeMode as ComposerMode);
            setIsOpen(true);
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.hash || ""}`,
            );
          }, 0)
        : undefined;

    const sections = ["stories", "feed", "threads", "marketplace", "gigs", "merch", "messages"]
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
      if (composeOpenTimer) window.clearTimeout(composeOpenTimer);
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

  useEffect(() => {
    const openComposer = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: ComposerMode }>).detail?.mode;

      if (mode && mode in modes) {
        setActiveMode(mode);
      } else {
        setActiveMode(modeFromHash(window.location.hash));
      }

      setIsOpen(true);
    };

    window.addEventListener("ttc-open-composer", openComposer);

    return () => window.removeEventListener("ttc-open-composer", openComposer);
  }, []);

  return (
    <>
      <button
        aria-label={`Create ${active.label}`}
        className="fixed bottom-24 right-5 z-30 flex h-14 max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,transparent)] bg-[var(--foreground)] px-3 text-[var(--background)] shadow-[0_14px_34px_rgba(0,0,0,0.34)] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#c8953b]/35 lg:bottom-5"
        onClick={() => setIsOpen(true)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand-gold)] text-[var(--ink)]">
          <ActiveIcon className="size-5" />
        </span>
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--paper-soft)_78%,transparent)]">
            Create
          </span>
          <span className="block truncate text-sm font-bold">{active.label}</span>
        </span>
        <Plus className="size-5 shrink-0" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-[color-mix(in_srgb,var(--foreground)_58%,transparent)] px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-5">
          <div className="mx-auto flex min-h-full max-w-xl items-end sm:items-center">
            <section className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--brand-gold)]">
                    <ActiveIcon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold">{active.title}</p>
                    <p className="text-xs text-[var(--muted-strong)]">{active.label}</p>
                  </div>
                </div>
                <button
                  aria-label="Close composer"
                  className="flex size-10 items-center justify-center rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)]"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="size-5" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-4 sm:py-4">
                {!canCreate ? (
                  <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-4">
                    <p className="text-sm font-semibold">
                      {isSignedIn
                        ? "Finish your profile to start posting."
                        : "Sign in to post, reply, list, and message."}
                    </p>
                    <Link
                      className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
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
