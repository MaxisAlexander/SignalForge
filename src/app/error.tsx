"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070b12] px-6 text-center">
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-white"
        >
          Home
        </Link>
      </div>
    </div>
  );
}