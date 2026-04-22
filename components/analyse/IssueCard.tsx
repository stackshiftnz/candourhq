"use client";

import React, { useState } from "react";
import { DiagnosisIssue } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Target,
  Feather,
  ShieldAlert,
  Layers,
  Zap,
  ChevronDown,
} from "lucide-react";

interface IssueCardProps {
  issue: DiagnosisIssue;
  issueId: string;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onCardClick?: (issueId: string) => void;
  isHovered?: boolean;
  onHoverIssue?: (id: string | null) => void;
}

const PRIORITY_BG: Record<string, string> = {
  trust: "bg-accent/5 border-accent/15 hover:bg-accent/10",
  substance: "bg-amber-500/5 border-amber-500/15 hover:bg-amber-500/10",
  style: "bg-green-500/5 border-green-500/15 hover:bg-green-500/10",
};

const NEUTRAL = "text-foreground bg-foreground/8 border-foreground/15";

const CATEGORY_META: Record<string, { icon: React.ElementType }> = {
  certainty_risk: { icon: ShieldAlert },
  unsupported_claim: { icon: ShieldAlert },
  low_specificity: { icon: Target },
  low_density: { icon: Layers },
  no_evidence: { icon: Target },
  ai_cliche: { icon: Feather },
  redundant_list: { icon: Zap },
  repetition: { icon: Feather },
  generic_phrasing: { icon: Feather },
  brand_mismatch: { icon: Zap },
};

export function IssueCard({
  issue,
  issueId,
  isSelected,
  onToggleSelect,
  onCardClick,
  isHovered,
  onHoverIssue,
}: IssueCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const meta = CATEGORY_META[issue.category] || { icon: AlertTriangle };
  const Icon = meta.icon;

  return (
    <div
      id={`card-${issueId}`}
      className={cn(
        "group relative border rounded-xl p-3 transition-all duration-200",
        PRIORITY_BG[issue.priority] || "bg-card border-border",
        isHovered && "shadow-md ring-1 ring-primary/10 scale-[1.01]",
        !isSelected && "opacity-50",
      )}
      onMouseEnter={() => onHoverIssue?.(issueId)}
      onMouseLeave={() => onHoverIssue?.(null)}
    >
      {/* Top row */}
      <div className="flex items-center gap-2.5">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(issueId); }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-border accent-primary shrink-0 cursor-pointer"
          aria-label={`${isSelected ? "Deselect" : "Select"} issue: ${issue.category.replace(/_/g, " ")}`}
        />

        {/* Category icon */}
        <div className={cn("p-1 rounded-md border shrink-0", NEUTRAL)}>
          <Icon size={11} strokeWidth={2.5} />
        </div>

        {/* Category label */}
        <span className="text-[9px] font-bold uppercase tracking-widest shrink-0 hidden sm:inline text-foreground/70">
          {issue.category.replace(/_/g, " ")}
        </span>

        {/* Phrase — clicking scrolls to highlight */}
        <button
          onClick={(e) => { e.stopPropagation(); onCardClick?.(issueId); }}
          className="flex-1 text-left px-2 py-1 rounded-lg bg-muted/40 text-[11px] font-bold italic text-foreground/80 truncate hover:bg-muted/70 transition-colors min-w-0"
          title={issue.phrase}
        >
          &ldquo;{issue.phrase}&rdquo;
        </button>

        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(p => !p); }}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? "Collapse explanation" : "Expand explanation"}
        >
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-200", isExpanded && "rotate-180")}
          />
        </button>
      </div>

      {/* Expandable explanation */}
      {isExpanded && (
        <div className="mt-2.5 ml-[calc(1rem+0.625rem+0.625rem+0.625rem)] text-[12px] text-foreground/70 leading-relaxed font-medium animate-in fade-in slide-in-from-top-1 duration-150">
          {issue.explanation}
        </div>
      )}

      {/* Hovered indicator */}
      {isHovered && (
        <div className="absolute top-2 right-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      )}
    </div>
  );
}
