export function ScanSkeleton() {
  return (
    <div className="mt-6 space-y-4 animate-pulse">
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-[var(--surface-2)]"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 rounded-xl bg-[var(--surface-2)]" />
        <div className="h-40 rounded-xl bg-[var(--surface-2)]" />
      </div>
      <p className="text-center text-sm text-cyan-400/80">
        Fetching SoSoValue live data…
      </p>
    </div>
  );
}