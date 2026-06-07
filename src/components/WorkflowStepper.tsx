import type { WorkflowStep } from "@/lib/types";

const STEPS: { id: WorkflowStep; label: string }[] = [
  { id: "scan", label: "Scan" },
  { id: "analyze", label: "Analyze" },
  { id: "signal", label: "Signal" },
  { id: "match", label: "Match" },
];

export function WorkflowStepper({ active }: { active: WorkflowStep }) {
  const activeIdx = STEPS.findIndex((s) => s.id === active);

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              i === activeIdx
                ? "bg-amber-500 text-black"
                : i < activeIdx
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`hidden text-sm sm:inline ${
              i === activeIdx ? "font-medium text-white" : "text-[var(--muted)]"
            }`}
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={`mx-1 hidden h-px flex-1 sm:block ${
                i < activeIdx ? "bg-cyan-500/40" : "bg-[var(--border)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}