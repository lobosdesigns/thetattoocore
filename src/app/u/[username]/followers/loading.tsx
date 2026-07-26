export default function FollowListLoading() {
  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-3xl overflow-x-hidden">
        <div className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="h-10 w-44 rounded-md bg-[color-mix(in_srgb,var(--foreground)_12%,transparent)]" />
        </div>
        <section className="border-b border-[var(--card-rim)] px-4 py-5" aria-label="Loading community list">
          <div className="mb-4 h-28 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_14%,var(--paper-warm))]" />
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-full bg-[color-mix(in_srgb,var(--foreground)_14%,var(--paper-warm))]" />
            <div className="grid gap-2">
              <div className="h-5 w-40 rounded-md bg-[color-mix(in_srgb,var(--foreground)_12%,var(--paper-warm))]" />
              <div className="h-4 w-32 rounded-md bg-[color-mix(in_srgb,var(--foreground)_9%,var(--paper-warm))]" />
            </div>
          </div>
        </section>
        <section className="grid gap-3 px-4 py-5">
          {[0, 1, 2, 3].map((item) => (
            <div className="h-28 rounded-md bg-[color-mix(in_srgb,var(--foreground)_9%,var(--paper-warm))]" key={item} />
          ))}
        </section>
      </div>
    </main>
  );
}