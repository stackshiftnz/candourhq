"use client";

import { useEffect, useState, useMemo } from "react";
import { Zap, Sparkles, Layers, ShieldCheck, Settings, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransformationViewProps {
  brandProfileName?: string | null;
  progress: number;
  isTakingLong?: boolean;
}

const STAGES = [
  { threshold: 0, icon: Settings, label: "Initialising transformation engine..." },
  { threshold: 20, icon: RefreshCw, label: "Injecting brand voice & tone parameters..." },
  { threshold: 45, icon: Layers, label: "Resolving substance gaps & specificity issues..." },
  { threshold: 70, icon: Sparkles, label: "Applying evidence anchors & flow..." },
  { threshold: 90, icon: ShieldCheck, label: "Finalising refinement protocol..." },
];

export function TransformationView({ brandProfileName, progress, isTakingLong }: TransformationViewProps) {
  const currentStage = useMemo(() => {
    return [...STAGES].reverse().find((s) => progress >= s.threshold) || STAGES[0];
  }, [progress]);

  const profileLabel = brandProfileName ? brandProfileName : "Default Profile";
  const displayLabel = currentStage.threshold === 20 
    ? `Injecting ${profileLabel} Voice...` 
    : currentStage.label;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 max-w-2xl mx-auto w-full animate-in fade-in duration-700">
      {/* --- Central Refinement Animation --- */}
      <div className="relative w-32 h-32 md:w-40 md:h-40">
        {/* Background Concentric Pulses */}
        <div className="absolute inset-0 rounded-3xl bg-secondary/5 animate-pulse" />
        <div className="absolute inset-[-10px] rounded-[40px] border border-secondary/10 animate-[ping_3s_linear_infinite]" />
        
        {/* Rotating Precision Ring */}
        <div className="absolute inset-0 rounded-3xl border-2 border-secondary/20 border-r-secondary border-b-secondary animate-spin [animation-duration:4s]" />
        
        {/* Inner Transformation Hub */}
        <div className="absolute inset-4 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex items-center justify-center overflow-hidden border border-border">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary/10 to-transparent animate-[shimmer_2s_linear_infinite]" />
          <currentStage.icon className="w-10 h-10 md:w-12 md:h-12 text-secondary animate-bounce" />
        </div>

        {/* Small Floating Nodes (Precision Points) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)] animate-pulse" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)] [animation-delay:1s] animate-pulse" />
      </div>

      {/* --- Progress & Refinement Ticker --- */}
      <div className="w-full space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground italic flex items-center justify-center gap-3">
             Refining Intelligence
          </h2>
          <div className="flex items-center justify-center gap-2 h-6">
            <span className="text-sm font-medium text-muted-foreground animate-in slide-in-from-bottom-2 duration-500" key={displayLabel}>
              {displayLabel}
            </span>
          </div>
        </div>

        <div className="relative w-full max-w-md mx-auto">
          {/* Progress Track */}
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
            {/* Animated Progress Fill */}
            <div 
              className="h-full bg-secondary transition-all duration-700 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2.5s_infinite]" />
            </div>
          </div>
          
          {/* Status Percent */}
          <div className="absolute -top-6 right-0">
             <span className="text-[10px] font-bold uppercase tracking-widest text-secondary/80">
               {Math.round(progress)}%
             </span>
          </div>
        </div>

        {/* --- Contextual Hints (Subtle) --- */}
        <p className="text-[13px] text-muted-foreground/60 max-w-sm mx-auto leading-relaxed h-10 flex items-center justify-center">
          {isTakingLong 
            ? "This transformer is deep-processing — almost there."
            : progress > 80 
              ? "Final alignment checks for publishing readiness..." 
              : "Converting quality signals into publishable content blocks."}
        </p>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
