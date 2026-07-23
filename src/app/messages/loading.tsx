import { ArrowLeft, MessageCircle } from "lucide-react";

const inboxPlaceholders = Array.from({ length: 7 }, (_, index) => index);

export default function MessagesLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading messages"
      className="ttc-page h-[100dvh] overflow-hidden"
    >
      <span className="sr-only" role="status">
        Loading messages
      </span>
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-1 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="ttc-page-panel min-h-0 min-w-0 overflow-hidden border-r border-[var(--card-rim)]">
          <header className="border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper)_95%,transparent)] px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div
                aria-hidden="true"
                className="ttc-surface flex size-10 shrink-0 items-center justify-center rounded-md border"
              >
                <ArrowLeft className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold">DM</p>
                <div className="mt-1 h-3 w-24 rounded-sm bg-[var(--surface-subtle)]" />
              </div>
              <div
                aria-hidden="true"
                className="size-10 shrink-0 rounded-full bg-[var(--surface-subtle)]"
              />
            </div>
            <div
              aria-hidden="true"
              className="ttc-surface h-10 rounded-md border"
            />
            <div
              aria-hidden="true"
              className="ttc-surface mt-3 h-10 rounded-md border"
            />
          </header>

          <div aria-hidden="true" className="divide-y divide-[var(--card-rim)]">
            {inboxPlaceholders.map((placeholder) => (
              <div className="flex h-20 items-center gap-3 px-4" key={placeholder}>
                <div className="size-11 shrink-0 rounded-full bg-[var(--surface-subtle)]" />
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-2/5 rounded-sm bg-[var(--surface-subtle)]" />
                  <div className="mt-3 h-3 w-4/5 rounded-sm bg-[var(--surface-subtle)]" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section
          aria-hidden="true"
          className="ttc-page-panel hidden min-h-0 min-w-0 items-center justify-center overflow-hidden lg:flex"
        >
          <MessageCircle className="size-10 text-[var(--muted-strong)]" />
        </section>
      </div>
    </main>
  );
}
