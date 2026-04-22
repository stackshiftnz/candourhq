"use client";

import { ChangeTag, DiagnosisIssue } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import { 
  CircleCheck, 
  Circle, 
  AlertTriangle, 
  Target, 
  Feather, 
  Zap,
  Check,
  X,
  Sparkles,
  Info,
  ArrowDown,
  LayoutList,
  Focus
} from "lucide-react";
import { Button } from "@/components/ui/Button";

type SidebarMode = "queue" | "focus";

interface SmartSidebarProps {
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  // Queue Props
  issues: DiagnosisIssue[];
  resolvedIssueIndices: Set<number>;
  activeIssueIndex: number | null;
  onIssueClick: (index: number) => void;
  // Focus Props
  focusedTag: ChangeTag | null;
  onCloseFocus: () => void;
  onRestore?: (tag: ChangeTag) => void;
}

const PRIORITY_META: Record<string, { color: string, icon: any }> = {
  trust: { color: "text-accent", icon: AlertTriangle },
  substance: { color: "text-secondary", icon: Target },
  style: { color: "text-green-500", icon: Feather },
};

export function SmartSidebar({
  mode,
  onModeChange,
  issues,
  resolvedIssueIndices,
  activeIssueIndex,
  onIssueClick,
  focusedTag,
  onCloseFocus,
  onRestore
}: SmartSidebarProps) {
  const priorities = ["trust", "substance", "style"] as const;

  return (
    <div className="flex flex-col h-full bg-background/80 backdrop-blur-xl border-l border-border/60 transition-all duration-300 overflow-hidden">
      {/* Sidebar Header / Mode Switcher */}
      <div className="h-16 px-6 border-b border-border/60 bg-background/60 backdrop-blur-xl flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onModeChange("queue")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300",
              mode === "queue" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <LayoutList size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Queue</span>
          </button>
          <button
            onClick={() => focusedTag && onModeChange("focus")}
            disabled={!focusedTag}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300",
              mode === "focus" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <Focus size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Focus</span>
          </button>
        </div>
        {mode === "focus" && (
          <button
            onClick={onCloseFocus}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-full transition-all text-muted-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {/* QUEUE MODE */}
        {mode === "queue" && (
          <div className="px-6 py-8 space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
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
                            "w-full text-left flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                            isActive 
                              ? "bg-muted shadow-lg scale-[1.02] z-10" 
                              : "hover:bg-muted/50 hover:translate-x-1"
                          )}
                        >
                          <div className="mt-1 shrink-0">
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
                              &ldquo;{issue.phrase.length > 60 ? issue.phrase.substring(0, 60) + "..." : issue.phrase}&rdquo;
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
            
            {issues.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <CircleCheck size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">All Issues Resolved</p>
                  <p className="text-xs text-muted-foreground">Your document is looking sharp.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOCUS MODE */}
        {mode === "focus" && focusedTag && (
          <div className="px-8 py-10 space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header / Type */}
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Sparkles size={20} />
               </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Intelligence Insight</span>
                   <h2 className="text-lg font-bold text-foreground capitalize">
                     {focusedTag.tag.replace(/_/g, " ")}
                   </h2>
                </div>
            </div>

            {/* Original Snippet */}
            <div className="space-y-4 group">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground transition-colors" />
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Original Reference</h3>
              </div>
              <div className="bg-muted/50 border border-border rounded-2xl p-6 text-[13px] text-muted-foreground italic leading-relaxed font-medium">
                &ldquo;{focusedTag.original_phrase}&rdquo;
              </div>
            </div>

            <div className="flex justify-center -my-6 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shadow-lg text-muted-foreground">
                  <ArrowDown size={14} />
               </div>
            </div>

            {/* Cleaned Snippet */}
            <div className="space-y-4 group">
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                   <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest">Enhanced Result</h3>
               </div>
               <div className="bg-primary/5 border border-primary/20 rounded-x2l p-6 text-[14px] text-foreground font-bold leading-relaxed shadow-sm shadow-primary/5 rounded-2xl">
                 &ldquo;{focusedTag.cleaned_phrase}&rdquo;
               </div>
            </div>

            {/* Explanation */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                 <Info size={14} className="text-muted-foreground opacity-50" />
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clean-up Logic</h3>
              </div>
              <div className="p-6 rounded-3xl bg-secondary/5 border border-secondary/10">
                 <p className="text-[13px] text-foreground/90 leading-relaxed font-medium">
                   {focusedTag.explanation}
                 </p>
              </div>
            </div>

            {/* Controls */}
            {onRestore && (
              <div className="pt-6">
                <Button 
                  variant="secondary" 
                  onClick={() => onRestore(focusedTag)}
                  className="w-full rounded-2xl h-12 text-xs font-bold"
                >
                  Restore Original Version
                </Button>
              </div>
            )}
          </div>
        )}

        {!focusedTag && mode === "focus" && (
           <div className="flex flex-col items-center justify-center h-full text-center p-12 space-y-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground opacity-20">
                <Focus size={32} />
              </div>
              <div className="space-y-2">
                 <p className="text-sm font-bold text-foreground">No Change Selected</p>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   Click on any highlighted correction in the text to see the intelligence and reasoning behind it.
                 </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onModeChange("queue")} className="rounded-full">
                View Critical Queue
              </Button>
           </div>
        )}
      </div>
      
      {/* Sidebar Footer */}
      {mode === "queue" && issues.length > 0 && (
        <div className="p-6 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              {resolvedIssueIndices.size} / {issues.length} Resolved
            </span>
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${(resolvedIssueIndices.size / issues.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
