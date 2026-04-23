import React from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  ShieldCheck,
  Zap,
  Info
} from "lucide-react";

interface ScoreBannerProps {
  originalScore: number;
  finalScore: number | null;
  resolvedCount: number;
  totalCount: number;
  profileName: string;
  rescoreError?: boolean;
}

export function ScoreBanner({
  originalScore,
  finalScore,
  resolvedCount,
  totalCount,
  profileName,
  rescoreError,
}: ScoreBannerProps) {
  const isFullyResolved = resolvedCount === totalCount;
  const isPending = finalScore === null && !rescoreError;

  return (
    <div
      className={cn(
        "relative flex flex-col md:flex-row md:items-center justify-between p-8 rounded-[40px] border mb-10 overflow-hidden transition-all duration-700 shadow-2xl",
        isFullyResolved 
          ? "bg-green-500/5 border-green-500/20 shadow-green-500/5" 
          : "bg-secondary/5 border-secondary/20 shadow-secondary/5"
      )}
    >
      {/* Decorative background flair */}
      <div className={cn(
        "absolute -right-20 -top-20 w-64 h-64 blur-[100px] opacity-20 pointer-events-none",
        isFullyResolved ? "bg-green-500" : "bg-secondary"
      )} />
      
      <div className="mb-6 md:mb-0 relative z-10 space-y-3">
        <div className="flex items-center gap-2">
           <div className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center border",
              isFullyResolved ? "bg-green-500/20 border-green-500/30 text-green-500" : "bg-secondary/20 border-secondary/30 text-secondary"
           )}>
              {isFullyResolved ? <ShieldCheck size={14} /> : <Zap size={14} />}
           </div>
           <span className={cn(
             "text-[10px] font-bold uppercase tracking-widest",
             isFullyResolved ? "text-green-500" : "text-secondary"
           )}>
             {isFullyResolved ? "All Issues Resolved" : "Improvements Applied"}
           </span>
        </div>
        
        <div>
           <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
              {isFullyResolved ? "Clean — No Issues Remaining" : "Content Optimised"}
           </h2>
           <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed mt-1">
             {resolvedCount} of {totalCount} issues resolved · {profileName} brand profile applied
           </p>
        </div>
      </div>

      <div className="flex items-center gap-8 relative z-10">
        <div className="flex flex-col items-end opacity-40">
           <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1 px-4">
              Original Score
           </p>
           <span className="text-2xl font-bold text-foreground line-through decoration-muted-foreground decoration-2">
             {originalScore.toFixed(1)}
           </span>
        </div>
        
        <div className="w-10 h-10 rounded-full bg-border/50 flex items-center justify-center text-muted-foreground/40">
           <ArrowRight size={20} />
        </div>

        <div className="flex flex-col items-end">
          <span className={cn(
             "text-[10px] font-bold uppercase tracking-widest mb-1",
             isFullyResolved ? "text-green-500" : "text-secondary"
          )}>
             Final Score
          </span>
          <div className="flex items-baseline gap-1 min-w-[80px] justify-end">
            {isPending ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                 <Spinner size="md" />
                 <span className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Syncing...</span>
              </div>
            ) : rescoreError && finalScore === null ? (
              <div className="flex flex-col items-end">
                 <div className="flex items-baseline gap-1">
                   <span className="text-4xl font-bold text-muted-foreground/40">
                     {originalScore.toFixed(1)}
                   </span>
                   <span className="text-lg font-bold text-muted-foreground/20">/10</span>
                 </div>
                 <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-accent">
                    <Info size={8} /> Using estimate
                 </div>
              </div>
            ) : (
              <>
                <span className={cn(
                  "text-5xl font-bold tracking-tighter",
                  isFullyResolved ? "text-green-500" : "text-secondary"
                )}>
                  {finalScore!.toFixed(1)}
                </span>
                <span className="text-xl font-bold text-muted-foreground/30">/10</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
