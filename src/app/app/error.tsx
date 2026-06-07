"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="text-xl font-semibold">App error</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
        {error.message || "Failed to load the workflow."}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]"
        >
          Reload app
        </Link>
      </div>
    </div>
  );
}