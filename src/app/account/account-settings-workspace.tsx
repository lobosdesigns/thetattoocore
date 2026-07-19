"use client";

import Link from "next/link";
import { Children, type ReactNode, useEffect, useMemo, useState } from "react";

export type AccountSettingsTab = {
  body: string;
  id: string;
  label: string;
  status: string;
};

function tabFromHash(hash: string, tabs: AccountSettingsTab[]) {
  const id = hash.replace(/^#/, "");

  return tabs.some((tab) => tab.id === id) ? id : tabs[0]?.id;
}

export function AccountSettingsWorkspace({
  children,
  tabs,
}: {
  children: ReactNode;
  tabs: AccountSettingsTab[];
}) {
  const childList = useMemo(() => Children.toArray(children), [children]);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

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
    <section className="ttc-card mb-4 rounded-lg border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] p-4 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-strong)]">
            Settings
          </p>
          <h2 className="mt-1 text-xl font-bold">Choose the area you need</h2>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="max-w-sm text-sm leading-6 text-[var(--muted-strong)] sm:text-right">
            Profile, orders, bookings, safety, and professional tools stay in
            their own areas so Account does not become one long scroll.
          </p>
          <Link
            className="ttc-surface inline-flex h-9 w-fit items-center justify-center rounded-md border px-3 text-xs font-bold"
            href="/settings"
          >
            Settings home
          </Link>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-2">
        {tabs.map((tab) => (
          <button
            aria-pressed={activeTab === tab.id}
            className={`h-10 shrink-0 rounded-md border px-3 text-sm font-bold ${
              activeTab === tab.id
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] text-[var(--foreground)]"
            }`}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              window.history.replaceState(null, "", `#${tab.id}`);
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {tabs.map((tab) => (
          <button
            className={`rounded-md border p-3 text-left transition sm:p-4 ${
              activeTab === tab.id
                ? "border-[color-mix(in_srgb,var(--gold)_72%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))]"
                : "border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)]"
            }`}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              window.history.replaceState(null, "", `#${tab.id}`);
            }}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold sm:text-base">{tab.label}</h3>
              <span className="shrink-0 rounded-md border border-[color-mix(in_srgb,var(--gold)_38%,var(--card-rim))] bg-[color-mix(in_srgb,var(--gold)_12%,var(--paper-warm))] px-2 py-1 text-[11px] font-bold text-[color-mix(in_srgb,var(--gold)_72%,var(--foreground))] sm:text-xs">
                {tab.status}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-strong)] sm:mt-2 sm:text-sm sm:leading-6">
              {tab.body}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-5">
        {childList.map((child, index) => {
          const tab = tabs[index];
          if (!tab) return null;

          return (
            <div
              className={activeTab === tab.id ? "block" : "hidden"}
              id={tab.id}
              key={tab.id}
            >
              {child}
            </div>
          );
        })}
      </div>
    </section>
  );
}
