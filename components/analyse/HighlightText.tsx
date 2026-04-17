"use client";

import React, { useMemo } from "react";
import { DiagnosisIssue } from "@/lib/anthropic/types";

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
  trust: "bg-red-100 hover:bg-red-200 border-red-200",
  substance: "bg-amber-100 hover:bg-amber-200 border-amber-200",
  style: "bg-pink-100 hover:bg-pink-200 border-pink-200",
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
    <div className="whitespace-pre-wrap leading-relaxed text-[15px] text-gray-800 dark:text-gray-200 font-sans">
      {segments.map((segment, idx) => {
        if (!segment.issue) {
          return <span key={idx}>{segment.text}</span>;
        }

        const issueId = `${segment.issue.priority}-${segment.issue.char_start}-${segment.issue.char_end}`;
        const isHovered = hoveredIssueId === issueId;
        const isResolved = resolvedIssueIds?.has(issueId);
        
        return (
          <span
            key={idx}
            id={`highlight-${issueId}`}
            className={[
              "rounded-sm border-b transition-all cursor-pointer relative group",
              isResolved ? "line-through opacity-40 bg-transparent border-transparent" : COLOR_MAP[segment.issue.priority] || "bg-gray-100",
              isHovered && !isResolved ? "ring-2 ring-gray-400 ring-offset-1" : ""
            ].join(" ")}
            onClick={() => !isResolved && onHighlightClick?.(issueId)}
            onMouseEnter={() => !isResolved && onHoverIssue?.(issueId)}
            onMouseLeave={() => !isResolved && onHoverIssue?.(null)}
          >
            {segment.text}
            
            {/* Tooltip */}
            {!isResolved && (
              <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[11px] rounded shadow-lg z-50 w-[min(12rem,80vw)] text-center pointer-events-none">
                {segment.issue.explanation}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

