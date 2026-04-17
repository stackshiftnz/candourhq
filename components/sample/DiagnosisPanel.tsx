"use client";

import type { DiagnosisResponse } from "@/lib/anthropic/types";
import { Button } from "@/components/ui/Button";

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score > 6) return "#639922";
  if (score >= 4) return "#EF9F27";
  return "#E24B4A";
}

// ─── Score row ────────────────────────────────────────────────────────────────

function ScoreRow({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score);
  const pct = `${(score / 10) * 100}%`;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-500 dark:text-gray-400 w-[90px] flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: pct, backgroundColor: color }}
        />
      </div>
      <span
        className="text-[11px] font-semibold w-6 text-right flex-shrink-0"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
      {children}
    </p>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DiagnosisPanelProps {
  diagnosis: DiagnosisResponse;
  onStartCleanup: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DiagnosisPanel({
  diagnosis,
  onStartCleanup,
}: DiagnosisPanelProps) {
  const { signals, headline_finding } = diagnosis;

  const headlineCard = (
    <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
        Main finding
      </p>
      <p className="text-[12px] text-gray-900 dark:text-gray-100 leading-relaxed">
        {headline_finding}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Diagnosis
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Mobile: headline first */}
        <div className="lg:hidden">{headlineCard}</div>

        {/* Substance */}
        <div>
          <SectionLabel>Substance</SectionLabel>
          <div className="flex flex-col gap-2">
            <ScoreRow
              label="Specificity"
              score={signals.substance.dimensions.specificity ?? 0}
            />
            <ScoreRow
              label="Evidence"
              score={signals.substance.dimensions.evidence ?? 0}
            />
            <ScoreRow
              label="Density"
              score={signals.substance.dimensions.info_density ?? 0}
            />
          </div>
        </div>

        {/* Style */}
        <div>
          <SectionLabel>Style</SectionLabel>
          <div className="flex flex-col gap-2">
            <ScoreRow
              label="Phrasing"
              score={signals.style.dimensions.generic_phrasing ?? 0}
            />
            <ScoreRow
              label="Repetition"
              score={signals.style.dimensions.repetition ?? 0}
            />
            <ScoreRow
              label="Readability"
              score={signals.style.dimensions.readability ?? 0}
            />
          </div>
        </div>

        {/* Trust */}
        <div>
          <SectionLabel>Trust</SectionLabel>
          <div className="flex flex-col gap-2">
            <ScoreRow
              label="Brand match"
              score={signals.trust.dimensions.brand_match ?? 0}
            />
            <ScoreRow
              label="Certainty risk"
              score={signals.trust.dimensions.certainty_risk ?? 0}
            />
          </div>
        </div>

        {/* Desktop: headline below scores */}
        <div className="hidden lg:block">{headlineCard}</div>
      </div>

      {/* Footer — start clean-up */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={onStartCleanup}
        >
          Start clean-up
        </Button>
      </div>
    </div>
  );
}
