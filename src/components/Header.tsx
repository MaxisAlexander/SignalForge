import Link from "next/link";

export function Header({ variant = "app" }: { variant?: "landing" | "app" }) {
  return (
    <header
      className={
        variant === "landing"
          ? "sticky top-0 z-50 border-b border-white/10 bg-black/25 backdrop-blur-md"
          : "glass sticky top-0 z-50 border-b"
      }
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-cyan-500 font-bold text-black">
            SF
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">SignalForge</h1>
            <p className="text-xs text-[var(--muted)]">
              {variant === "landing"
                ? "Research → execution"
                : "Live workflow"}
            </p>
          </div>
        </Link>
        {variant === "landing" ? (
          <Link
            href="/app"
            className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-medium text-black"
          >
            Open app
          </Link>
        ) : (
          <Link
            href="/"
            className="text-sm text-[var(--muted)] hover:text-amber-400"
          >
            Landing
          </Link>
        )}
      </div>
    </header>
  );
}