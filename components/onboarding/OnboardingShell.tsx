"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// ─── Step helpers ─────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type StepState = "active" | "done" | "todo";

function currentStep(pathname: string): Step {
  if (pathname.startsWith("/onboarding/save")) return 3;
  if (pathname.startsWith("/onboarding/preferences")) return 2;
  return 1;
}

function progressFor(step: Step): number {
  if (step === 1) return 33;
  if (step === 2) return 66;
  return 100;
}

function stepState(num: Step, current: Step): StepState {
  if (num === current) return "active";
  if (num < current) return "done";
  return "todo";
}

const STEP_LABELS: Record<Step, { short: string; full: string }> = {
  1: { short: "1", full: "1 — Writing examples" },
  2: { short: "2", full: "2 — Language and tone" },
  3: { short: "3", full: "3 — Save profile" },
};

const STEPS: Step[] = [1, 2, 3];

// ─── Disabled nav items ───────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard" },
  { label: "New document" },
  { label: "History" },
  { label: "Brand profiles" },
  { label: "Settings" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const step = currentStep(pathname);
  const progress = progressFor(step);
  const sidebarSubtitle =
    step < 3 ? "Setting up your workspace" : "Almost ready";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* ── Progress bar — 3px strip pinned to top of viewport ── */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gray-200 dark:bg-gray-800 z-50">
        <div
          className="h-full bg-gray-900 dark:bg-white"
          style={{
            width: `${progress}%`,
            transition: "width 400ms ease",
          }}
        />
      </div>

      {/* ── Topbar — 48px, sits directly below the progress bar ── */}
      <header className="fixed top-[3px] left-0 right-0 h-12 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-5 z-40">
        {/* Left label */}
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">
          Set up your brand profile
        </span>

        {/* Step pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {STEPS.map((num) => {
            const state = stepState(num, step);
            return (
              <span
                key={num}
                className={[
                  "text-[11px] font-medium rounded-full px-2.5 py-1 whitespace-nowrap",
                  state === "active"
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "",
                  state === "done"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "",
                  state === "todo"
                    ? "bg-gray-100 text-gray-400 border border-gray-200 dark:bg-gray-900 dark:text-gray-600 dark:border-gray-700"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Short label on xs, full label on sm+ */}
                <span className="sm:hidden">{STEP_LABELS[num].short}</span>
                <span className="hidden sm:inline">{STEP_LABELS[num].full}</span>
              </span>
            );
          })}
        </div>
      </header>

      {/* ── Page body — below progress bar (3px) + topbar (48px) = 51px ── */}
      <div className="flex pt-[51px]">
        {/* Disabled sidebar — desktop only (lg+) */}
        <aside
          className="hidden lg:flex fixed left-0 top-[51px] w-[200px] flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
          style={{ height: "calc(100vh - 51px)" }}
        >
          {/* Wordmark */}
          <div className="px-5 pt-6 pb-4">
            <p className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight">
              Candour
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {sidebarSubtitle}
            </p>
          </div>

          {/* Greyed-out, non-interactive nav */}
          <nav className="flex-1 px-2">
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <div
                    aria-hidden="true"
                    className="flex items-center px-3 py-2 text-sm rounded-md text-gray-400 dark:text-gray-600 opacity-40 cursor-not-allowed pointer-events-none select-none"
                  >
                    {item.label}
                  </div>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main content area */}
        <main className="flex-1 lg:ml-[200px] min-h-[calc(100vh-51px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
