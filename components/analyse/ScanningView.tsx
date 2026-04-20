"use client";

import { useEffect, useState, useMemo } from "react";
import { Zap, ShieldCheck, Sparkles, Search, Fingerprint, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanningViewProps {
  brandProfileName?: string | null;
  progress: number;
  isTakingLong?: boolean;
}

const STAGES = [
  { threshold: 0, icon: Search, label: "Reading document structure..." },
  { threshold: 15, icon: Fingerprint, label: "Aligning with brand identity..." },
  { threshold: 35, icon: BarChart3, label: "Scanning for Substance & Specificity..." },
  { threshold: 55, icon: Sparkles, label: "Evaluating Style & Readability..." },
  { threshold: 75, icon: ShieldCheck, label: "Checking Trust Signals & Certainty Risks..." },
  { threshold: 92, icon: Zap, label: "Finalising Quality Report..." },
];

export function ScanningView({ brandProfileName, progress, isTakingLong }: ScanningViewProps) {
  const currentStage = useMemo(() => {
    return [...STAGES].reverse().find((s) => progress >= s.threshold) || STAGES[0];
  }, [progress]);

  const profileLabel = brandProfileName ? brandProfileName : "Default Profile";
  const displayLabel = currentStage.threshold === 15 
    ? `Aligning with ${profileLabel}...` 
    : currentStage.label;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 max-w-2xl mx-auto w-full animate-in fade-in duration-700">
      {/* --- Central Scanner Animation --- */}
      <div className="relative w-32 h-32 md:w-40 md:h-40">
        {/* Background Glowing Rings */}
        <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
        <div className="absolute inset-0 rounded-full border border-primary/10 scale-110" />
        <div className="absolute inset-0 rounded-full border border-primary/5 scale-125" />
        
        {/* Rotating Intelligence Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin [animation-duration:3s]" />
        
        {/* Inner Scanning Content */}
        <div className="absolute inset-4 rounded-full bg-white dark:bg-gray-900 shadow-2xl flex items-center justify-center overflow-hidden border border-border">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent animate-[scan_2s_linear_infinite]" />
          <currentStage.icon className="w-10 h-10 md:w-12 md:h-12 text-primary animate-pulse" />
        </div>

        {/* Small Floating Nodes */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full shadow-[0_0_10px_rgba(255,212,128,0.5)] animate-bounce" />
        <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-accent rounded-full shadow-[0_0_10px_rgba(255,147,147,0.5)] [animation-delay:0.5s] animate-bounce" />
      </div>

      {/* --- Progress & Ticker --- */}
      <div className="w-full space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Analysing Intelligence
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
              className="h-full bg-primary transition-all duration-500 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
            </div>
          </div>
          
          {/* Status Percent */}
          <div className="absolute -top-6 right-0">
             <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
               {Math.round(progress)}%
             </span>
          </div>
        </div>

        {/* --- Contextual Hints (Subtle) --- */}
        <p className="text-[13px] text-muted-foreground/60 max-w-sm mx-auto leading-relaxed h-10 flex items-center justify-center">
          {isTakingLong 
            ? "This is taking a little longer than usual — almost there."
            : progress > 80 
              ? "Final checks for certainty risk and brand consistency..." 
              : "Reviewing Substance, Style, and Trust to ensure publishable quality."}
        </p>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
