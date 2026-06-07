"use client";

import { useState } from "react";

export function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      void copy(e);
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={copy}
      onKeyDown={onKeyDown}
      className="ml-1 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--border)] text-[10px] text-[var(--muted)] hover:border-cyan-500/50 hover:text-cyan-300"
      title="Copy"
      aria-label={`Copy ${value}`}
    >
      {copied ? "✓" : "⎘"}
    </span>
  );
}