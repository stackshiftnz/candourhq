import React from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { getScoreColour } from "@/lib/utils/score-colour";

interface ScoreRowProps {
  label: string;
  original: number;
  final: number | null;
  rescoreError?: boolean;
}

function ScoreRow({ label, original, final, rescoreError }: ScoreRowProps) {
  const isPending = final === null && !rescoreError;

  return (
    <div className="py-3 px-4 flex justify-between items-center border-b border-gray-100 last:border-0">
      <span className="text-[12px] text-gray-600 font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-gray-400 line-through">
          {original.toFixed(1)}
        </span>
        <span className="text-[12px] text-gray-400">→</span>
        <div className="w-8 flex justify-end">
          {isPending ? (
            <Spinner size="sm" className="text-gray-300" />
          ) : rescoreError && final === null ? (
            <span className="text-[13px] font-bold text-gray-400">
              {original.toFixed(1)}
            </span>
          ) : (
            <span className={cn("text-[13px] font-bold", getScoreColour(final!))}>
              {final!.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ScoreBreakdownCardProps {
  originalSubstance: number;
  finalSubstance: number | null;
  originalStyle: number;
  finalStyle: number | null;
  originalTrust: number;
  finalTrust: number | null;
  originalAverage: number;
  finalAverage: number | null;
  rescoreError?: boolean;
}

export function ScoreBreakdownCard({
  originalSubstance,
  finalSubstance,
  originalStyle,
  finalStyle,
  originalTrust,
  finalTrust,
  originalAverage,
  finalAverage,
  rescoreError
}: ScoreBreakdownCardProps) {
  const isPending = finalAverage === null && !rescoreError;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex flex-col">
        <ScoreRow label="Substance" original={originalSubstance} final={finalSubstance} rescoreError={rescoreError} />
        <ScoreRow label="Style" original={originalStyle} final={finalStyle} rescoreError={rescoreError} />
        <ScoreRow label="Trust" original={originalTrust} final={finalTrust} rescoreError={rescoreError} />

        <div className="py-4 px-4 bg-gray-50 flex justify-between items-center">
          <span className="text-[12px] text-gray-900 font-bold uppercase tracking-tight">Average Score</span>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-gray-400 line-through">
              {originalAverage.toFixed(1)}
            </span>
            <span className="text-[13px] text-gray-400">→</span>
            <div className="flex items-baseline gap-1 min-w-[34px] justify-end">
              {isPending ? (
                <Spinner size="sm" className="text-gray-300" />
              ) : rescoreError && finalAverage === null ? (
                <span className="text-[16px] font-extrabold text-gray-400">
                  {originalAverage.toFixed(1)}
                </span>
              ) : (
                <>
                  <span className={cn("text-[16px] font-extrabold", getScoreColour(finalAverage!))}>
                    {finalAverage!.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold">/10</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white">
        {rescoreError && finalAverage === null ? (
          <p className="text-[13px] text-amber-600 font-medium text-center">
            Using estimated scores — recalculation failed.
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 leading-tight">
            Final scores are recalculated by a fresh analysis pass — more accurate than the live estimates shown during clean-up.
          </p>
        )}
      </div>
    </div>
  );
}
