"use client";

import { DiagnosisIssue } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Target, 
  Feather, 
  Zap,
  Check
} from "lucide-react";

interface IssueQueueProps {
  issues: DiagnosisIssue[];
  resolvedIssueIndices: Set<number>;
  activeIssueIndex: number | null; // Renamed for consistency with parent
  onIssueClick: (index: number) => void;
}

const PRIORITY_META: Record<string, { color: string, icon: any }> = {
  trust: { color: "text-accent", icon: AlertTriangle },
  substance: { color: "text-secondary", icon: Target },
  style: { color: "text-green-500", icon: Feather },
};

export function IssueQueue({
  issues,
  resolvedIssueIndices,
  activeIssueIndex,
  onIssueClick
}: IssueQueueProps) {
  const priorities = ["trust", "substance", "style"] as const;

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar space-y-10 relative z-10">
        {priorities.map((priority) => {
          const priorityIssues = issues.filter((i) => i.priority === priority);
          if (priorityIssues.length === 0) return null;

          const meta = PRIORITY_META[priority];
          const Icon = meta.icon;

          return (
            <div key={priority} className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                 <Icon size={12} className={cn("opacity-50", meta.color)} />
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {priority} Criticality
                  </h3>
              </div>
              
              <div className="space-y-1">
                {issues.map((issue, idx) => {
                  if (issue.priority !== priority) return null;
                  
                  const isResolved = resolvedIssueIndices.has(idx);
                  const isActive = activeIssueIndex === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => onIssueClick(idx)}
                      className={cn(
                        "w-full text-left flex items-start gap-3 p-3 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                        isActive 
                          ? "bg-background border border-border shadow-xl shadow-black/5 scale-[1.02] z-10" 
                          : "hover:bg-background/40 hover:translate-x-1"
                      )}
                    >
                      <div className="mt-1 shrink-0 relative">
                         {isResolved ? (
                           <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center animate-in zoom-in duration-300">
                             <Check size={10} className="text-green-500" strokeWidth={3} />
                           </div>
                         ) : (
                           <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              isActive ? "border-primary bg-primary/5" : "border-muted group-hover:border-muted-foreground/30"
                           )}>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                           </div>
                         )}
                      </div>

                      <div className="flex flex-col gap-1 min-w-0">
                        <span className={cn(
                          "text-[13px] leading-snug transition-all duration-300",
                          isResolved 
                            ? "text-muted-foreground/40 line-through font-medium" 
                            : isActive 
                              ? "text-foreground font-bold" 
                              : "text-muted-foreground font-medium group-hover:text-foreground"
                        )}>
                          &ldquo;{issue.phrase.length > 50 ? issue.phrase.substring(0, 50) + "..." : issue.phrase}&rdquo;
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">
                          {issue.category.replace(/_/g, " ")}
                        </span>
                      </div>

                      {isActive && (
                         <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary opacity-20">
                            <Zap size={14} fill="currentColor" />
                         </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
