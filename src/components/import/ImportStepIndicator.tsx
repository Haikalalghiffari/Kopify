"use client";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Unggah" },
  { id: 2, label: "Pemetaan" },
  { id: 3, label: "Pratinjau" },
  { id: 4, label: "Konfirmasi" },
] as const;

export function ImportStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol
      className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center sm:justify-between mb-8"
      aria-label="Tahapan impor"
    >
      {STEPS.map((step, index) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-2 text-sm",
              active && "text-emerald-800 font-semibold",
              done && "text-slate-700",
              !active && !done && "text-slate-400"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                active && "border-emerald-600 bg-emerald-600 text-white",
                done && "border-emerald-200 bg-emerald-50 text-emerald-700",
                !active && !done && "border-slate-200 bg-white text-slate-500"
              )}
              aria-current={active ? "step" : undefined}
            >
              {step.id}
            </span>
            <span>{step.label}</span>
            {index < STEPS.length - 1 && (
              <span
                className="hidden sm:inline mx-3 text-slate-300"
                aria-hidden
              >
                /
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}