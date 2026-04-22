"use client";

import React, { useState, useRef, useEffect } from "react";
import { DiagnosisIssue, IssuePriority } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { IssueCard } from "./IssueCard";

interface IssueGroupProps {
  priority: IssuePriority;
  issues: DiagnosisIssue[];
  selectedIssueIds: Set<string>;
  onToggleIssue: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  hoveredIssueId: string | null;
  onHoverIssue: (id: string | null) => void;
  onCardClick: (issueId: string) => void;
}

const PRIORITY_CONFIG: Record<IssuePriority, { label: string; dotClass: string; badgeClass: string }> = {
  trust: {
    label: "Trust Issues",
    dotClass: "bg-accent shadow-accent/30",
    badgeClass: "bg-accent/10 text-accent border-accent/20",
  },
  substance: {
    label: "Substance Issues",
    dotClass: "bg-amber-500 shadow-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  style: {
    label: "Style Issues",
    dotClass: "bg-green-500 shadow-green-500/30",
    badgeClass: "bg-green-500/10 text-green-600 border-green-500/20",
  },
};

function getIssueId(issue: DiagnosisIssue): string {
  return issue.issue_id ?? `${issue.priority}-${issue.char_start}-${issue.char_end}`;
}

export function IssueGroup({
  priority,
  issues,
  selectedIssueIds,
  onToggleIssue,
  onSelectAll,
  hoveredIssueId,
  onHoverIssue,
  onCardClick,
}: IssueGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const config = PRIORITY_CONFIG[priority];

  const allIds = issues.map(getIssueId);
  const selectedCount = allIds.filter(id => selectedIssueIds.has(id)).length;
  const allSelected = selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <div className="space-y-2">
      {/* Group header */}
      <div className="flex items-center gap-3 py-2 px-1">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={allSelected}
          onChange={() => onSelectAll(allIds)}
          className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
          aria-label={`Select all ${config.label}`}
        />
        <div className={cn("w-2 h-2 rounded-full shadow-md shrink-0", config.dotClass)} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60 flex-1">
          {config.label}
        </span>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[9px] font-black border shrink-0",
          config.badgeClass
        )}>
          {issues.length}
        </span>
        <button
          onClick={() => setIsCollapsed(p => !p)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={isCollapsed ? `Expand ${config.label}` : `Collapse ${config.label}`}
        >
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-200", isCollapsed && "-rotate-90")}
          />
        </button>
      </div>

      {/* Issue cards */}
      {!isCollapsed && (
        <div className="space-y-2 pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {issues.map((issue) => {
            const issueId = getIssueId(issue);
            return (
              <IssueCard
                key={issueId}
                issue={issue}
                issueId={issueId}
                isSelected={selectedIssueIds.has(issueId)}
                onToggleSelect={onToggleIssue}
                onCardClick={onCardClick}
                isHovered={hoveredIssueId === issueId}
                onHoverIssue={onHoverIssue}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
