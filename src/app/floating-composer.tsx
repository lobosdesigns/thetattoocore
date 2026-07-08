"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  createFeedPost,
  createMarketplaceListing,
  createThreadPost,
} from "./actions";
import { startConversation } from "./messages/actions";

type ComposerMode = "feed" | "threads" | "marketplace" | "messages";

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
    label: "Feed",
    title: "Feed post",
  },
  threads: {
    icon: MessageCircle,
    label: "Threads",
    title: "Thread",
  },
  marketplace: {
    icon: ShoppingBag,
    label: "Market",
    title: "Listing",
  },
  messages: {
    icon: Send,
    label: "Message",
    title: "New message",
  },
};

function modeFromHash(hash: string): ComposerMode {
  if (hash === "#threads") return "threads";
  if (hash === "#marketplace") return "marketplace";
  if (hash === "#messages") return "messages";

  return "feed";
}

function limitWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) return value;

  return words.slice(0, maxWords).join(" ");
}

export function FloatingComposer({
  canCreate,
  isSignedIn,
}: {
  canCreate: boolean;
  isSignedIn: boolean;
}) {
  const [activeMode, setActiveMode] = useState<ComposerMode>(() =>
    typeof window === "undefined" ? "feed" : modeFromHash(window.location.hash),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [feedCaption, setFeedCaption] = useState("");
  const active = modes[activeMode];
  const ActiveIcon = active.icon;

  useEffect(() => {
    const onHashChange = () => setActiveMode(modeFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);

    const sections = ["feed", "threads", "marketplace", "messages"]
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

  const feedWordCount = useMemo(
    () => feedCaption.trim().split(/\s+/).filter(Boolean).length,
    [feedCaption],
  );

  return (
    <>
      <button
        aria-label={`Create ${active.label}`}
        className="fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-md bg-[#171412] text-white shadow-[0_12px_30px_rgba(23,20,18,0.28)] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#c8953b]/30"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="size-7" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 bg-[#171412]/45 px-4 py-5 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full max-w-xl items-end sm:items-center">
            <section className="w-full rounded-md border border-[#d8d1c6] bg-[#fffdf9] shadow-2xl">
              <header className="flex items-center justify-between gap-3 border-b border-[#e5ded4] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#efe7da]">
                    <ActiveIcon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold">{active.title}</p>
                    <p className="text-xs text-[#766d62]">{active.label}</p>
                  </div>
                </div>
                <button
                  aria-label="Close composer"
                  className="flex size-10 items-center justify-center rounded-md border border-[#d8d1c6] bg-white"
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
                ) : null}

                {canCreate && activeMode === "feed" ? (
                  <form action={createFeedPost} className="space-y-3">
                    <textarea
                      className="min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                      maxLength={360}
                      name="caption"
                      onChange={(event) =>
                        setFeedCaption(limitWords(event.target.value, 40))
                      }
                      placeholder="Short caption"
                      required
                      value={feedCaption}
                    />
                    <div className="flex justify-end text-xs text-[#766d62]">
                      {feedWordCount}/40 words
                    </div>
                    <input
                      className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                      name="style_tags"
                      placeholder="blackwork, fine line"
                    />
                    <input
                      className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                      name="location_label"
                      placeholder="Austin, TX"
                    />
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      className="block w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#efe7da] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
                      name="media"
                      required
                      type="file"
                    />
                    <button className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                      Publish
                    </button>
                  </form>
                ) : null}

                {canCreate && activeMode === "threads" ? (
                  <form action={createThreadPost} className="space-y-3">
                    <textarea
                      className="min-h-44 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                      maxLength={1000}
                      name="body"
                      placeholder="Start a thread"
                      required
                    />
                    <button className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                      Post thread
                    </button>
                  </form>
                ) : null}

                {canCreate && activeMode === "marketplace" ? (
                  <form action={createMarketplaceListing} className="space-y-3">
                    <input
                      className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                      maxLength={120}
                      name="title"
                      placeholder="Flash sheet, chair rental, supplies"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                        name="price"
                        placeholder="80"
                      />
                      <select
                        className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                        name="category"
                      >
                        <option value="flash">Flash</option>
                        <option value="guest-spot">Guest spot</option>
                        <option value="chair">Chair</option>
                        <option value="supplies">Supplies</option>
                        <option value="service">Service</option>
                      </select>
                    </div>
                    <textarea
                      className="min-h-24 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                      maxLength={2000}
                      name="description"
                      placeholder="Details, terms, dates, or pickup/shipping notes."
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                        name="city"
                        placeholder="City"
                      />
                      <input
                        className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                        name="region"
                        placeholder="State"
                      />
                    </div>
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      className="block w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#efe7da] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
                      name="media"
                      type="file"
                    />
                    <button className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                      Publish listing
                    </button>
                  </form>
                ) : null}

                {canCreate && activeMode === "messages" ? (
                  <form action={startConversation} className="space-y-3">
                    <div className="flex items-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3">
                      <Search className="size-4 text-[#766d62]" />
                      <input
                        className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                        name="username"
                        placeholder="username"
                        required
                      />
                    </div>
                    <textarea
                      className="min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
                      maxLength={4000}
                      name="body"
                      placeholder="Message"
                      required
                    />
                    <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
                      <Send className="size-4" />
                      Send
                    </button>
                  </form>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
