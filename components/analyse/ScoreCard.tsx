"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { getScoreColors } from "./SignalBlock";

interface ScoreCardProps {
  label: string;
  score: number;
}

export function ScoreCard({ label, score }: ScoreCardProps) {
  const colors = getScoreColors(score);
  const scoreLabel = score <= 3 ? "Critical" : score <= 6 ? "Needs work" : "Good";

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-2xl border transition-all duration-300",
      colors.light,
      colors.border
    )}>
      <span className="text-[9px] font-black uppercase tracking-widest text-foreground/50">{label}</span>
      <span className={cn("text-2xl font-black tracking-tighter leading-none", colors.text)}>{score}</span>
      <span className={cn("text-[8px] font-bold uppercase tracking-wider opacity-70", colors.text)}>{scoreLabel}</span>
    </div>
  );
}
