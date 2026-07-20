"use client";

import {
  Children,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ProfileContentTab = {
  count: number;
  id: string;
  label: string;
};

function tabFromHash(hash: string, tabs: ProfileContentTab[]) {
  const id = hash.replace(/^#/, "");

  return tabs.some((tab) => tab.id === id) ? id : tabs[0]?.id;
}

export function ProfileContentTabs({
  children,
  tabs,
}: {
  children: ReactNode;
  tabs: ProfileContentTab[];
}) {
  const childList = useMemo(() => Children.toArray(children), [children]);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const activateTab = (tabId: string) => {
    setActiveTab(tabId);
    window.history.replaceState(null, "", `#${tabId}`);
  };
  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const lastIndex = tabs.length - 1;
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    const nextTab = tabs[nextIndex];
    if (!nextTab) return;

    event.preventDefault();
    activateTab(nextTab.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${nextTab.id}-tab`)?.focus();
    });
  };

  useEffect(() => {
    const syncTab = () => {
      const nextTab = tabFromHash(window.location.hash, tabs);

      if (nextTab) setActiveTab(nextTab);
    };

    syncTab();
    window.addEventListener("hashchange", syncTab);

    return () => window.removeEventListener("hashchange", syncTab);
  }, [tabs]);

  return (
    <section className="border-b border-[var(--card-rim)] px-4 py-6">
      <div
        aria-label="Profile content"
        className="sticky top-[65px] z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto border-y border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_96%,transparent)] px-4 py-3 backdrop-blur"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              aria-controls={tab.id}
              aria-selected={isActive}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold ${
                isActive
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "ttc-surface hover:border-[var(--brand-gold)]"
              }`}
              id={`${tab.id}-tab`}
              key={tab.id}
              onClick={() => {
                activateTab(tab.id);
              }}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs ${
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--background)_24%,transparent)] text-[var(--background)]"
                    : "bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--paper-warm))] text-[var(--muted)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {childList.map((child, index) => {
        const tab = tabs[index];
        if (!tab) return null;

        return (
          <div
            aria-labelledby={`${tab.id}-tab`}
            className={activeTab === tab.id ? "block" : "hidden"}
            id={tab.id}
            key={tab.id}
            role="tabpanel"
            tabIndex={0}
          >
            {child}
          </div>
        );
      })}
    </section>
  );
}
