import React from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { getScoreColour } from "@/lib/utils/score-colour";
import { 
  Target, 
  Feather, 
  ShieldAlert, 
  ArrowRight, 
  Percent,
  CircleCheck,
  Info
} from "lucide-react";

interface ScoreRowProps {
  label: string;
  original: number;
  final: number | null;
  rescoreError?: boolean;
  icon: React.ReactNode;
}

function ScoreRow({ label, original, final, rescoreError, icon }: ScoreRowProps) {
  const isPending = final === null && !rescoreError;

  return (
    <div className="group py-4 px-6 flex justify-between items-center border-b border-border/50 last:border-0 hover:bg-muted/30 transition-all duration-300">
      <div className="flex items-center gap-3">
         <div className="text-muted-foreground/40 group-hover:text-primary transition-colors">
            {icon}
         </div>
         <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{label}</span>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-[12px] font-bold text-muted-foreground/30 line-through">
          {original.toFixed(1)}
        </span>
        <ArrowRight size={12} className="text-muted-foreground/20" />
        <div className="w-10 flex justify-end">
          {isPending ? (
            <Spinner size="sm" className="text-muted-foreground/50" />
          ) : rescoreError && final === null ? (
            <span className="text-[13px] font-bold text-muted-foreground opacity-40">
              {original.toFixed(1)}
            </span>
          ) : (
            <span className={cn("text-[14px] font-bold tabular-nums", getScoreColour(final!))}>
              {final!.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ScoreBreakdownCardProps {
  originalSubstance: number;
  finalSubstance: number | null;
  originalStyle: number;
  finalStyle: number | null;
  originalTrust: number;
  finalTrust: number | null;
  originalAverage: number;
  finalAverage: number | null;
  rescoreError?: boolean;
}

export function ScoreBreakdownCard({
  originalSubstance,
  finalSubstance,
  originalStyle,
  finalStyle,
  originalTrust,
  finalTrust,
  originalAverage,
  finalAverage,
  rescoreError
}: ScoreBreakdownCardProps) {
  const isPending = finalAverage === null && !rescoreError;

  return (
    <div className="bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl shadow-black/5">
      <div className="flex flex-col">
        <ScoreRow label="Substance" original={originalSubstance} final={finalSubstance} rescoreError={rescoreError} icon={<Target size={14} />} />
        <ScoreRow label="Style" original={originalStyle} final={finalStyle} rescoreError={rescoreError} icon={<Feather size={14} />} />
        <ScoreRow label="Trust" original={originalTrust} final={finalTrust} rescoreError={rescoreError} icon={<ShieldAlert size={14} />} />

        {/* Global Average Sync Section */}
        <div className="py-6 px-6 bg-muted/40 border-t border-border flex justify-between items-center relative overflow-hidden group/average">
          <div className="flex flex-col relative z-10 transition-transform group-hover/average:translate-x-1 duration-300">
             <span className="text-[11px] text-foreground font-bold tracking-tight mb-0.5">Overall Average</span>
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Combined score across all dimensions</span>
             </div>
          </div>
          
          <div className="flex items-center gap-6 relative z-10">
            <span className="text-xl font-bold text-muted-foreground/20 line-through tabular-nums decoration-2">
              {originalAverage.toFixed(1)}
            </span>
            <div className="flex items-baseline gap-1 min-w-[50px] justify-end">
              {isPending ? (
                <Spinner size="sm" className="text-muted-foreground/40" />
              ) : rescoreError && finalAverage === null ? (
                <span className="text-2xl font-bold text-muted-foreground opacity-30">
                  {originalAverage.toFixed(1)}
                </span>
              ) : (
                <>
                  <span className={cn("text-3xl font-bold tracking-tighter tabular-nums", getScoreColour(finalAverage!))}>
                    {finalAverage!.toFixed(1)}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground/30 ml-0.5">/10</span>
                </>
              )}
            </div>
          </div>
          
          {/* Subtle background flair */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Footer metadata explanation */}
      <div className="p-6 bg-card border-t border-border/50">
        {rescoreError && finalAverage === null ? (
          <div className="flex items-center gap-3 text-accent bg-accent/5 p-4 rounded-2xl border border-accent/10">
             <Info size={14} className="shrink-0" />
             <p className="text-[11px] font-bold leading-tight">
               Score recalculation failed. Showing estimated values.
             </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 opacity-60">
             <CircleCheck size={14} className="mt-0.5 text-primary" />
             <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
               Final scores calculated from the cleaned content. Improvements reflect all changes applied during cleanup.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
