"use client";

import React, { useState } from "react";
import { DiagnosisSignal } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  ChevronUp, 
  Info, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus
} from "lucide-react";

interface SignalBlockProps {
  name: string;
  signal: DiagnosisSignal;
  defaultExpanded?: boolean;
  issueCount?: number;
  isActive?: boolean;
  onViewIssues?: () => void;
}

export function getScoreColors(score: number) {
  if (score <= 3) return { text: "text-accent", bg: "bg-accent", border: "border-accent/10", light: "bg-accent/5", glow: "shadow-accent/20" };
  if (score <= 6) return { text: "text-secondary", bg: "bg-secondary", border: "border-secondary/10", light: "bg-secondary/5", glow: "shadow-secondary/20" };
  return { text: "text-emerald-500", bg: "bg-emerald-500", border: "border-emerald-500/10", light: "bg-emerald-500/5", glow: "shadow-emerald-20/20" };
}

export function SignalBlock({ name, signal, defaultExpanded = false, issueCount, isActive, onViewIssues }: SignalBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const colors = getScoreColors(signal.score);

  return (
    <div className={cn(
      "group transition-all duration-500 ease-out flex flex-col",
      isActive ? "opacity-100" : "opacity-90 grayscale-[0.2] hover:grayscale-0",
      isExpanded ? "gap-6" : "gap-4"
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left flex items-start justify-between group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-5">
          <div className={cn(
            "relative w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg transition-all duration-500",
            isActive ? "scale-110 shadow-2xl" : "scale-100",
            colors.text,
            colors.light,
            isActive ? "ring-2 ring-current ring-offset-2" : "border border-border/50"
          )}>
            {signal.score}
            {isActive && (
              <div className={cn("absolute -top-1 -right-1 w-3 h-3 rounded-full bg-background flex items-center justify-center")}>
                 <div className={cn("w-2 h-2 rounded-full", colors.bg, "animate-pulse")} />
              </div>
            )}
          </div>
          <div className="flex flex-col py-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-1 leading-none">
              {name}
            </span>
            <div className="flex items-center gap-2">
               <h3 className="text-sm font-bold text-foreground capitalize tracking-tight">{name} Signal</h3>
               {!isActive && (signal.score < 5 ? <TrendingDown size={12} className="text-secondary/60" /> : <TrendingUp size={12} className="text-emerald-600/60" />)}
            </div>
          </div>
        </div>
        
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-foreground/20 group-hover:text-foreground transition-all duration-300",
          isExpanded ? "rotate-180 text-foreground" : "rotate-0"
        )}>
          <ChevronDown size={16} strokeWidth={2.5} />
        </div>
      </button>

      {/* Progress Visualization - Minimalist */}
      <div className={cn("flex flex-col gap-3 transition-all duration-300", isExpanded ? "px-0" : "px-0")}>
        <div className="h-[2px] w-full bg-muted/60 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-1000 ease-out", colors.bg)} 
            style={{ width: `${signal.score * 10}%` }}
          />
        </div>
        
        <p className={cn(
          "text-[12px] font-medium leading-relaxed transition-colors",
          isActive ? "text-foreground" : "text-foreground/70"
        )}>
          {signal.description}
        </p>
      </div>

      {typeof issueCount === "number" && issueCount > 0 && onViewIssues && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewIssues();
          }}
          className={cn(
            "group/btn w-fit flex items-center gap-2 px-0 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
            isActive ? "text-primary translate-x-1" : "text-foreground/40 hover:text-foreground"
          )}
        >
          Resolve {issueCount} {issueCount === 1 ? "Issue" : "Issues"} 
          <ArrowRight size={12} className={cn("transition-transform group-hover/btn:translate-x-1", isActive ? "translate-x-1" : "")} />
        </button>
      )}

      {isExpanded && (
        <div className="pt-2 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(signal.dimensions).map(([dim, score]) => {
              const dimColors = getScoreColors(score);
              return (
                <div key={dim} className="group/dim flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-[80px]">
                    <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest mb-1">
                      {dim.replace(/_/g, " ")}
                    </span>
                    <span className={cn("text-[12px] font-black", dimColors.text)}>
                      {score}<span className="text-[9px] font-bold opacity-30 ml-0.5">/10</span>
                    </span>
                  </div>
                  <div className="flex-1 h-[1px] bg-muted relative">
                     <div 
                        className={cn("absolute top-0 left-0 h-full transition-all duration-1000", dimColors.bg)}
                        style={{ width: `${score * 10}%` }}
                      />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {!isActive && <div className="h-px bg-border/40 mt-2" />}
    </div>
  );
}
