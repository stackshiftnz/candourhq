"use client";

import React, { useMemo } from "react";
import { DiagnosisIssue } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";

interface HighlightTextProps {
  content: string;
  issues: DiagnosisIssue[];
  resolvedIssueIds?: Set<string>;
  onHighlightClick?: (issueId: string) => void;
  hoveredIssueId?: string | null;
  onHoverIssue?: (issueId: string | null) => void;
}

const PRIORITY_MAP: Record<string, number> = {
  trust: 0,
  substance: 1,
  style: 2,
};

const COLOR_MAP = {
  trust: "bg-accent/15 border-accent/20 hover:bg-accent/25",
  substance: "bg-secondary/15 border-secondary/20 hover:bg-secondary/25",
  style: "bg-green-500/15 border-green-500/20 hover:bg-green-500/25",
};

export function HighlightText({ 
  content, 
  issues, 
  resolvedIssueIds,
  onHighlightClick,
  hoveredIssueId,
  onHoverIssue 
}: HighlightTextProps) {
  const segments = useMemo(() => {
    if (!content) return [];
    if (!issues || issues.length === 0) return [{ text: content, issue: null }];

    const boundaries = new Set<number>([0, content.length]);
    issues.forEach(issue => {
      if (issue.char_start >= 0 && issue.char_start <= content.length) {
        boundaries.add(issue.char_start);
      }
      if (issue.char_end >= 0 && issue.char_end <= content.length) {
        boundaries.add(issue.char_end);
      }
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const result = [];

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
       const start = sortedBoundaries[i];
       const end = sortedBoundaries[i + 1];
       const segmentText = content.slice(start, end);

       // Find all issues covering this segment
       const coveringIssues = issues.filter(
         issue => issue.char_start <= start && issue.char_end >= end
       );

       // Pick highest priority issue
       let topIssue = null;
       if (coveringIssues.length > 0) {
         topIssue = coveringIssues.reduce((prev, curr) => {
           if (!prev) return curr;
           const p1 = PRIORITY_MAP[prev.priority] ?? 99;
           const p2 = PRIORITY_MAP[curr.priority] ?? 99;
           return p1 <= p2 ? prev : curr;
         });
       }

       result.push({
         text: segmentText,
         issue: topIssue,
         start,
         end
       });
    }

    return result;
  }, [content, issues]);

  return (
    <div className="whitespace-pre-wrap leading-relaxed text-[16px] lg:text-[17px] text-foreground font-medium tracking-tight font-sans selection:bg-primary/20">
      {segments.map((segment, idx) => {
        if (!segment.issue) {
          return <span key={idx} className="opacity-80">{segment.text}</span>;
        }

        const issueId = `${segment.issue.priority}-${segment.issue.char_start}-${segment.issue.char_end}`;
        const isHovered = hoveredIssueId === issueId;
        const isResolved = resolvedIssueIds?.has(issueId);
        
        return (
          <span
            key={idx}
            id={`highlight-${issueId}`}
            className={cn(
              "rounded-md px-0.5 mx-[-1px] border-b-2 transition-all duration-300 cursor-pointer relative group inline-block py-0.5",
              isResolved 
                ? "line-through opacity-30 bg-transparent border-transparent" 
                : COLOR_MAP[segment.issue.priority] || "bg-muted",
              isHovered && !isResolved && "ring-4 ring-primary/10 shadow-[0_4px_20px_rgba(0,0,0,0.1)] scale-[1.01] z-10"
            )}
            onClick={() => !isResolved && onHighlightClick?.(issueId)}
            onMouseEnter={() => !isResolved && onHoverIssue?.(issueId)}
            onMouseLeave={() => !isResolved && onHoverIssue?.(null)}
          >
            {segment.text}
            
            {/* Premium Glassmorphic Tooltip */}
            {!isResolved && (
              <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-3 bg-card/90 backdrop-blur-xl border border-border text-foreground text-[12px] font-bold rounded-[20px] shadow-2xl z-50 w-[max-content] max-w-[280px] text-left pointer-events-none animate-in fade-in zoom-in-90 duration-200">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 mb-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        segment.issue.priority === 'trust' ? 'bg-accent' : segment.issue.priority === 'substance' ? 'bg-secondary' : 'bg-green-500'
                      )} />
                      <span className="text-[10px] uppercase tracking-widest opacity-50">{segment.issue.category.replace(/_/g, " ")}</span>
                   </div>
                   {segment.issue.explanation}
                </div>
                {/* Arrow */}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-border" />
                <span className="absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-card" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

