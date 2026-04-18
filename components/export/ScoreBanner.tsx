import React from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

interface ScoreBannerProps {
  originalScore: number;
  finalScore: number | null;
  resolvedCount: number;
  totalCount: number;
  profileName: string;
  rescoreError?: boolean;
}

export function ScoreBanner({
  originalScore,
  finalScore,
  resolvedCount,
  totalCount,
  profileName,
  rescoreError,
}: ScoreBannerProps) {
  const isFullyResolved = resolvedCount === totalCount;
  const isPending = finalScore === null && !rescoreError;

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border mb-8",
        isFullyResolved 
          ? "bg-green-50 border-green-200" 
          : "bg-amber-50 border-amber-200"
      )}
    >
      <div className="mb-4 md:mb-0">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider block mb-1",
          isFullyResolved ? "text-green-700" : "text-amber-700"
        )}>
          {isFullyResolved ? "CLEAN COMPLETE" : "PARTIALLY CLEANED"}
        </span>
        <p className="text-[13px] text-gray-600">
          {resolvedCount} of {totalCount} issues resolved · {profileName} applied
        </p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[20px] text-gray-400 line-through">
          {originalScore.toFixed(1)}
        </span>
        <span className="text-[20px] text-gray-400">→</span>
        <div className="flex items-baseline gap-1 min-w-[50px] justify-end">
          {isPending ? (
            <Spinner size="md" className="text-gray-400" />
          ) : rescoreError && finalScore === null ? (
            <>
              <span className={cn(
                "text-[28px] font-semibold",
                isFullyResolved ? "text-green-700/50" : "text-amber-700/50"
              )}>
                {originalScore.toFixed(1)}
              </span>
              <span className="text-[14px] text-gray-400 font-medium">/10</span>
            </>
          ) : (
            <>
              <span className={cn(
                "text-[28px] font-semibold",
                isFullyResolved ? "text-green-700" : "text-amber-700"
              )}>
                {finalScore!.toFixed(1)}
              </span>
              <span className="text-[14px] text-gray-400 font-medium">/10</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
