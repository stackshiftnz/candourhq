"use client";

import React, { useState } from "react";
import { DiagnosisSignal } from "@/lib/anthropic/types";

interface SignalBlockProps {
  name: string;
  signal: DiagnosisSignal;
  defaultExpanded?: boolean;
  issueCount?: number;
  onViewIssues?: () => void;
}

export function getScoreColor(score: number) {
  if (score <= 3) return { text: "text-[#A32D2D]", bg: "bg-[#E24B4A]", border: "border-[#E24B4A]" };
  if (score <= 6) return { text: "text-[#854F0B]", bg: "bg-[#EF9F27]", border: "border-[#EF9F27]" };
  return { text: "text-[#27500A]", bg: "bg-[#639922]", border: "border-[#639922]" };
}

export function SignalBlock({ name, signal, defaultExpanded = false, issueCount, onViewIssues }: SignalBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const colors = getScoreColor(signal.score);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0 py-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left flex items-center justify-between group"
        aria-expanded={isExpanded}
        aria-label={`${name} signal, score ${signal.score} out of 10. ${isExpanded ? "Collapse" : "Expand"} dimensions.`}
      >
        <div className="flex flex-col">
          <span className="text-[12px] font-medium text-gray-900 dark:text-white capitalize">
            {name}
          </span>
          <div className="flex items-baseline gap-1">
            <span className={`text-[18px] font-semibold ${colors.text}`}>
              {signal.score}
            </span>
            <span className="text-[12px] text-gray-400">/10</span>
          </div>
        </div>
        
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Progress Bar */}
      <div className="mt-2 h-[4px] w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors.bg} transition-all duration-500`} 
          style={{ width: `${signal.score * 10}%` }}
        />
      </div>

      <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400 leading-normal">
        {signal.description}
      </p>

      {typeof issueCount === "number" && issueCount > 0 && onViewIssues && (
        <button
          onClick={onViewIssues}
          className="mt-2 text-[11px] font-medium text-gray-500 hover:text-gray-900 underline underline-offset-2 transition-colors"
        >
          View {issueCount} {issueCount === 1 ? "issue" : "issues"} driving this score →
        </button>
      )}

      {isExpanded && (
        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {Object.entries(signal.dimensions).map(([dim, score]) => {
            const dimColors = getScoreColor(score);
            return (
              <div key={dim} className="flex items-center justify-between">
                <span className="text-[12px] text-gray-400 capitalize">
                  {dim.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-[60px] h-[3px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${dimColors.bg}`}
                      style={{ width: `${score * 10}%` }}
                    />
                  </div>
                  <span className={`text-[12px] font-bold w-4 text-right ${dimColors.text}`}>
                    {score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
