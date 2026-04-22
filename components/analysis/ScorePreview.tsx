"use client";

import React from "react";
import { Sparkles, ArrowRight, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewData = {
  scoreRange: "low" | "medium" | "high";
  headline: string;
  flaggedCategory: string;
  flaggedPhrase: string | null;
  issueCount: number;
};

interface ScorePreviewProps {
  data: PreviewData | null;
  isLoading: boolean;
  isVisible: boolean;
  onAction?: () => void;
}

export function ScorePreview({ data, isLoading, isVisible, onAction }: ScorePreviewProps) {
  if (!isVisible && !isLoading) return null;

  const config = data?.scoreRange ? {
    low: {
      color: "bg-red-500",
      bg: "bg-red-500/5",
      border: "border-red-500/20",
      text: "text-red-600 dark:text-red-400",
      icon: <AlertCircle className="text-red-500" size={18} />,
      label: "Needs significant work",
      phraseLabel: "Critical example",
      phraseBg: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
    },
    medium: {
      color: "bg-amber-500",
      bg: "bg-amber-500/5",
      border: "border-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      icon: <Info className="text-amber-500" size={18} />,
      label: "Some issues to address",
      phraseLabel: "Example issue",
      phraseBg: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    },
    high: {
      color: "bg-emerald-500",
      bg: "bg-emerald-500/5",
      border: "border-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="text-emerald-500" size={18} />,
      label: "Mostly clean",
      phraseLabel: "Closest call",
      phraseBg: "bg-zinc-500/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-400",
    },
  }[data.scoreRange] : {
    color: "bg-zinc-500",
    bg: "bg-zinc-500/5",
    border: "border-zinc-500/20",
    text: "text-zinc-600 dark:text-zinc-400",
    icon: <AlertCircle className="text-zinc-500" size={18} />,
    label: "Scan unavailable",
    phraseLabel: "Example issue",
    phraseBg: "bg-zinc-500/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-400",
  };

  const isError = !isLoading && !data?.scoreRange && isVisible;

  const issueCount = data?.issueCount ?? 0;
  const issueLabel = issueCount === 0 ? "0 issues" : issueCount === 1 ? "1 issue" : `${issueCount} issues`;

  // For high score with no flagged phrase or zero issues, show clean confirmation instead
  const showCleanConfirmation = data?.scoreRange === "high" && (issueCount === 0 || !data?.flaggedPhrase);
  const showPhraseSection = data?.scoreRange && data?.flaggedPhrase && !showCleanConfirmation;

  return (
    <div className={cn(
      "mx-6 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500",
      !isVisible && !isLoading && "animate-out fade-out slide-out-to-bottom-2 fill-mode-forwards"
    )}>
      <div className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-md p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-500 shadow-xl shadow-black/5",
        config.bg,
        config.border
      )}>
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Running pre-flight scan...</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 flex-1">
          <div className="relative">
            <div className={cn("w-3 h-3 rounded-full animate-pulse", config.color)} />
            <div className={cn("absolute inset-0 w-3 h-3 rounded-full blur-[4px]", config.color)} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", config.text)}>
                {config.label}
              </span>
              {data?.scoreRange && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span className={cn("text-[10px] font-bold uppercase tracking-[0.15em]", config.text, "opacity-70")}>
                    {issueLabel}
                  </span>
                </>
              )}
              <span className="text-muted-foreground/30">•</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={10} className="text-primary" /> Pre-flight Result
              </span>
            </div>
            <h4 className="text-sm md:text-base font-bold tracking-tight text-foreground">
              {isError ? "Unable to complete pre-flight scan. Run full analysis for details." : (data?.headline || "Scanning content for quality patterns...")}
            </h4>
          </div>
        </div>

        {(showPhraseSection || showCleanConfirmation) && (
          <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
            {showPhraseSection && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{config.phraseLabel}:</span>
                <div className={cn("px-2 py-1 rounded-md border text-xs font-medium italic", config.phraseBg)}>
                  &ldquo;{data!.flaggedPhrase}&rdquo;
                </div>
              </div>
            )}
            {showCleanConfirmation && (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">No patterns flagged</span>
              </div>
            )}
            <button
              onClick={onAction}
              className="flex items-center gap-1.5 text-primary text-[11px] font-bold uppercase tracking-widest group cursor-pointer hover:opacity-80 transition-opacity outline-none"
            >
              See full diagnosis <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {data?.scoreRange && !showPhraseSection && !showCleanConfirmation && (
          <button
            onClick={onAction}
            className="flex items-center gap-1.5 text-primary text-[11px] font-bold uppercase tracking-widest group cursor-pointer hover:opacity-80 transition-opacity outline-none"
          >
            See full diagnosis <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
          </button>
        )}
      </div>
    </div>
  );
}
