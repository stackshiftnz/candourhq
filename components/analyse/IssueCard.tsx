"use client";

import React from "react";
import { DiagnosisIssue } from "@/lib/anthropic/types";

interface IssueCardProps {
  issue: DiagnosisIssue;
  onCardClick?: (issueId: string) => void;
  isHovered?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  certainty_risk: "bg-[#FEE2E2] text-[#791F1F]",
  unsupported_claim: "bg-[#FEE2E2] text-[#791F1F]",
  low_specificity: "bg-[#FEF3C7] text-[#633806]",
  low_density: "bg-[#FEF3C7] text-[#633806]",
  no_evidence: "bg-[#FEF3C7] text-[#633806]",
  ai_cliche: "bg-[#FCE7F3] text-[#72243E]",
  redundant_list: "bg-[#FCE7F3] text-[#72243E]",
  repetition: "bg-[#FCE7F3] text-[#72243E]",
  generic_phrasing: "bg-[#FCE7F3] text-[#72243E]",
  brand_mismatch: "bg-[#EEEDFE] text-[#3C3489]",
};

export function IssueCard({ issue, onCardClick, isHovered }: IssueCardProps) {
  const issueId = `${issue.priority}-${issue.char_start}-${issue.char_end}`;

  return (
    <div
      id={`card-${issueId}`}
      onClick={() => onCardClick?.(issueId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick?.(issueId);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${issue.priority} issue, ${issue.category.replace(/_/g, " ")}: ${issue.phrase}`}
      className={[
        "border border-gray-100 dark:border-gray-800 rounded-xl p-3 mb-2 cursor-pointer transition-all",
        "hover:bg-gray-50 dark:hover:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1",
        isHovered ? "ring-2 ring-gray-400 ring-offset-1 bg-gray-50 dark:bg-gray-900 border-gray-200" : ""
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[12px] font-medium text-gray-900 dark:text-white leading-tight italic">
          &quot;{issue.phrase}&quot;
        </span>
        <span className={[
          "px-1.5 py-0.5 rounded text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap",
          CATEGORY_COLORS[issue.category] || "bg-gray-100 text-gray-700"
        ].join(" ")}>
          {issue.category.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-normal">
        {issue.explanation}
      </p>
    </div>
  );
}
