"use client";

import React from "react";
import { DiagnosisResponse, IssuePriority } from "@/lib/anthropic/types";
import { Database } from "@/types/database";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight, CircleCheck, X, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScoreCard } from "./ScoreCard";
import { IssueGroup } from "./IssueGroup";

type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];

interface IssuesDashboardProps {
  data: DiagnosisResponse;
  diagnosis: Diagnosis;
  selectedIssueIds: Set<string>;
  onToggleIssue: (id: string) => void;
  onToggleGroup: (priority: IssuePriority, allIds: string[]) => void;
  hoveredIssueId: string | null;
  onHoverIssue: (id: string | null) => void;
  onCardClick: (issueId: string) => void;
  onBeginCleanup: () => void;
  tipDismissed: boolean;
  onDismissTip: () => void;
  isCleaning: boolean;
}

const PRIORITIES: IssuePriority[] = ["trust", "substance", "style"];

export function IssuesDashboard({
  data,
  diagnosis,
  selectedIssueIds,
  onToggleIssue,
  onToggleGroup,
  hoveredIssueId,
  onHoverIssue,
  onCardClick,
  onBeginCleanup,
  tipDismissed,
  onDismissTip,
  isCleaning,
}: IssuesDashboardProps) {
  const issueCount = data.issues.length;
  const selectedCount = selectedIssueIds.size;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 custom-scrollbar pb-28">

        {/* Step header */}
        <div className="border-b border-border pb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Step 1 of 2</span>
          </div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Review Your Content Findings</h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Select the issues you want to fix, then click Begin Clean-up to proceed.
          </p>
        </div>

        {/* Score summary bar */}
        <div className="grid grid-cols-3 gap-2">
          <ScoreCard label="Substance" score={diagnosis.substance_score} />
          <ScoreCard label="Style" score={diagnosis.style_score} />
          <ScoreCard label="Trust" score={diagnosis.trust_score} />
        </div>

        {/* Headline finding */}
        <div className="bg-card border border-border/60 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Key Finding</span>
          </div>
          <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 italic">
            &ldquo;{data.headline_finding}&rdquo;
          </p>
        </div>

        {/* Tip banner */}
        {!tipDismissed && issueCount > 0 && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-2xl px-4 py-3">
            <Info size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-foreground/70 leading-relaxed flex-1">
              <span className="font-bold text-foreground">How it works:</span> Check or uncheck issues below to decide what gets fixed. Highlighted text in your content dims when an issue is deselected.
            </p>
            <button
              onClick={onDismissTip}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label="Dismiss tip"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Issue groups or empty state */}
        {issueCount === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
            <div className="w-20 h-20 rounded-[40%] bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
              <CircleCheck size={36} strokeWidth={1.5} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold tracking-tight">Enterprise Ready</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Your content meets all quality and brand standards. Ready for publication.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {PRIORITIES.map(priority => {
              const priorityIssues = data.issues.filter(i => i.priority === priority);
              if (priorityIssues.length === 0) return null;
              const allIds = priorityIssues.map(i => i.issue_id ?? `${i.priority}-${i.char_start}-${i.char_end}`);
              return (
                <IssueGroup
                  key={priority}
                  priority={priority}
                  issues={priorityIssues}
                  selectedIssueIds={selectedIssueIds}
                  onToggleIssue={onToggleIssue}
                  onSelectAll={() => onToggleGroup(priority, allIds)}
                  hoveredIssueId={hoveredIssueId}
                  onHoverIssue={onHoverIssue}
                  onCardClick={onCardClick}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky footer CTA */}
      <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-md px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className={cn(
            "text-sm font-bold transition-colors",
            selectedCount === 0 ? "text-muted-foreground" : "text-foreground"
          )}>
            {selectedCount} {selectedCount === 1 ? "issue" : "issues"} selected
          </span>
          {issueCount > 0 && selectedCount < issueCount && (
            <span className="text-[10px] text-muted-foreground">
              {issueCount - selectedCount} skipped
            </span>
          )}
        </div>
        <Button
          variant="brand"
          size="md"
          className="rounded-full px-6 font-bold tracking-tight shadow-md transition-all active:scale-[0.98]"
          onClick={onBeginCleanup}
          disabled={issueCount > 0 && (selectedCount === 0 || isCleaning)}
        >
          {issueCount === 0 ? "Export" : "Begin Clean-up"}
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </div>
    </div>
  );
}
