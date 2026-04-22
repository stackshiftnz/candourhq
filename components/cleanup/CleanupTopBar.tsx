"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, History, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CleanupTopBarProps {
  documentTitle: string;
  progressPercent: number;
  resolvedCount: number;
  totalCount: number;
  originalScore: number;
  finalScore: number | null;
  streamComplete: boolean;
  pauseCardsRemaining: number;
  onExport: () => void;
  onHistory: () => void;
  onBack: () => void;
  onAcceptRemaining: () => void;
}

export function CleanupTopBar({
  documentTitle,
  progressPercent,
  resolvedCount,
  totalCount,
  originalScore,
  finalScore,
  streamComplete,
  pauseCardsRemaining,
  onExport,
  onHistory,
  onBack,
  onAcceptRemaining,
}: CleanupTopBarProps) {
  const lift = finalScore !== null ? finalScore - originalScore : null;

  return (
    <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur-xl z-30">
      {/* Main row */}
      <div className="h-14 px-4 lg:px-5 flex items-center justify-between gap-3">
        {/* Left: back + step label */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none mb-0.5">
              Step 2 of 2 — Review Your Clean-up
            </p>
            <p className="text-[12px] font-bold text-foreground truncate max-w-[140px] sm:max-w-[220px] lg:max-w-[300px] leading-tight">
              {documentTitle}
            </p>
          </div>
        </div>

        {/* Centre: score lift */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 border border-border shrink-0 text-[11px] font-bold">
          <span className="text-foreground/50">{originalScore.toFixed(1)}</span>
          <ArrowRight size={9} className="text-muted-foreground" />
          {finalScore !== null ? (
            <span className={cn(
              lift !== null && lift > 0.05 ? "text-emerald-600" :
              lift !== null && lift < -0.05 ? "text-accent" :
              "text-foreground/50"
            )}>
              {finalScore.toFixed(1)}
              {lift !== null && Math.abs(lift) > 0.05 && (
                <span className="ml-1 text-[9px] font-bold opacity-70">
                  {lift > 0 ? "+" : ""}{lift.toFixed(1)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-foreground/25">--</span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {pauseCardsRemaining > 0 && (
            <button
              onClick={onAcceptRemaining}
              className="hidden lg:flex h-8 px-3 items-center gap-1.5 rounded-xl text-[10px] font-bold text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-all"
            >
              Accept Remaining
            </button>
          )}
          <button
            onClick={onHistory}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            title="Revision history"
          >
            <History size={13} />
          </button>
          <Button
            variant="primary"
            size="sm"
            onClick={onExport}
            disabled={!streamComplete}
            className="h-8 px-4 text-[11px] font-bold rounded-xl"
          >
            Export
            <ArrowRight size={11} className="ml-1" />
          </Button>
        </div>
      </div>

      {/* Progress row */}
      <div className="px-4 lg:px-5 pb-2.5 flex items-center gap-3">
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0 tabular-nums">
          {resolvedCount} / {totalCount}
        </span>
      </div>
    </div>
  );
}
