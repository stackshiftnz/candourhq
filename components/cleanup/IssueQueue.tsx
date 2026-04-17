"use client";

import { DiagnosisIssue } from "@/lib/anthropic/types";

interface IssueQueueProps {
  issues: DiagnosisIssue[];
  resolvedIssueIndices: Set<number>;
  activeIndex: number | null;
  onItemClick: (index: number) => void;
}

export function IssueQueue({
  issues,
  resolvedIssueIndices,
  activeIndex,
  onItemClick
}: IssueQueueProps) {
  const priorities = ["trust", "substance", "style"] as const;

  const getDotColour = (priority: string, isResolved: boolean) => {
    if (isResolved) return "bg-gray-300";
    if (priority === "trust") return "bg-red-500";
    if (priority === "substance") return "bg-amber-500";
    if (priority === "style") return "bg-purple-400";
    return "bg-gray-300";
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-l border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-white">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          Issue Queue
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-8">
        {priorities.map((priority) => {
          const priorityIssues = issues.filter((i) => i.priority === priority);
          if (priorityIssues.length === 0) return null;

          return (
            <div key={priority}>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {priority}
              </h3>
              <div className="space-y-1.5">
                {issues.map((issue, idx) => {
                  if (issue.priority !== priority) return null;
                  
                  const isResolved = resolvedIssueIndices.has(idx);
                  const isActive = activeIndex === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => onItemClick(idx)}
                      className={`w-full text-left flex items-start gap-2.5 p-1.5 -mx-1.5 rounded-lg transition-colors group ${
                        isActive ? "bg-white shadow-sm" : "hover:bg-gray-100/50"
                      }`}
                    >
                      <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 transition-colors ${getDotColour(priority, isResolved)}`} />
                      <div className={`text-[13px] leading-tight transition-all ${
                        isResolved 
                          ? "text-gray-400 line-through opacity-40" 
                          : isActive 
                            ? "text-gray-900 font-medium" 
                            : "text-gray-500 group-hover:text-gray-700"
                      }`}>
                        <span className="italic pr-1">&quot;{issue.phrase.length > 30 ? issue.phrase.substring(0, 30) + "..." : issue.phrase}&quot;</span>
                        <span className="block text-[11px] opacity-60 font-normal">
                          {issue.category.replace(/_/g, " ")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-5 bg-white border-t border-gray-100 space-y-2 mt-auto">
        {/* Footer buttons will be injected from the main screen usually, but I'll add them here if requested */}
      </div>
    </div>
  );
}
