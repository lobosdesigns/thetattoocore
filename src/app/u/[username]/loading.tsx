export default function ProfileLoading() {
  return (
    <main className="ttc-page min-h-screen overflow-x-hidden">
      <div className="ttc-page-panel mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden">
        <div className="sticky top-0 z-10 border-b border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="h-10 w-36 rounded-md bg-[color-mix(in_srgb,var(--foreground)_12%,transparent)]" />
            <div className="size-10 rounded-md bg-[color-mix(in_srgb,var(--foreground)_12%,transparent)]" />
          </div>
        </div>
        <section className="border-b border-[var(--card-rim)] px-4 py-6" aria-label="Loading profile">
          <div className="mb-5 aspect-[3/1] min-h-36 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_14%,var(--paper-warm))] sm:min-h-56" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="size-24 rounded-full bg-[color-mix(in_srgb,var(--foreground)_14%,var(--paper-warm))]" />
            <div className="grid flex-1 gap-3">
              <div className="h-8 w-64 max-w-full rounded-md bg-[color-mix(in_srgb,var(--foreground)_14%,var(--paper-warm))]" />
              <div className="h-4 w-32 rounded-md bg-[color-mix(in_srgb,var(--foreground)_10%,var(--paper-warm))]" />
              <div className="h-20 rounded-md bg-[color-mix(in_srgb,var(--foreground)_8%,var(--paper-warm))]" />
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((item) => (
                  <div className="h-8 w-24 rounded-md bg-[color-mix(in_srgb,var(--foreground)_10%,var(--paper-warm))]" key={item} />
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-3 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div className="aspect-[4/5] rounded-md bg-[color-mix(in_srgb,var(--foreground)_9%,var(--paper-warm))]" key={item} />
          ))}
        </section>
      </div>
    </main>
  );
}