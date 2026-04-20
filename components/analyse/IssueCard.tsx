"use client";

import React from "react";
import { DiagnosisIssue } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import { 
  AlertTriangle, 
  Target, 
  Feather, 
  ShieldAlert, 
  Layers, 
  Zap, 
  ChevronRight,
  Eye
} from "lucide-react";

interface IssueCardProps {
  issue: DiagnosisIssue;
  onCardClick?: (issueId: string) => void;
  isHovered?: boolean;
  isActive?: boolean;
}

const CATEGORY_META: Record<string, { icon: any, colorClass: string }> = {
  certainty_risk: { icon: ShieldAlert, colorClass: "text-accent bg-accent/10 border-accent/20" },
  unsupported_claim: { icon: ShieldAlert, colorClass: "text-accent bg-accent/10 border-accent/20" },
  low_specificity: { icon: Target, colorClass: "text-secondary bg-secondary/10 border-secondary/20" },
  low_density: { icon: Layers, colorClass: "text-secondary bg-secondary/10 border-secondary/20" },
  no_evidence: { icon: Target, colorClass: "text-secondary bg-secondary/10 border-secondary/20" },
  ai_cliche: { icon: Feather, colorClass: "text-green-500 bg-green-500/10 border-green-500/20" },
  redundant_list: { icon: Zap, colorClass: "text-green-500 bg-green-500/10 border-green-500/20" },
  repetition: { icon: Feather, colorClass: "text-green-500 bg-green-500/10 border-green-500/20" },
  generic_phrasing: { icon: Feather, colorClass: "text-green-500 bg-green-500/10 border-green-500/20" },
  brand_mismatch: { icon: Zap, colorClass: "text-primary bg-primary/10 border-primary/20" },
};

export function IssueCard({ issue, onCardClick, isHovered, isActive }: IssueCardProps) {
  const issueId = `${issue.priority}-${issue.char_start}-${issue.char_end}`;
  const meta = CATEGORY_META[issue.category] || { icon: AlertTriangle, colorClass: "text-muted-foreground bg-muted border-border" };
  const Icon = meta.icon;

  return (
    <div
      id={`card-${issueId}`}
      onClick={() => onCardClick?.(issueId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick?.(issueId);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${issue.priority} issue, ${issue.category.replace(/_/g, " ")}: ${issue.phrase}`}
      className={cn(
        "group relative border rounded-2xl p-4 mb-3 cursor-pointer transition-all duration-300",
        "bg-card hover:bg-muted/30 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5",
        "focus:outline-none focus:ring-2 focus:ring-primary/20",
        isHovered && "border-primary/50 bg-muted/40 shadow-lg ring-2 ring-primary/10",
        isActive ? "border-primary/20 bg-primary/[0.02]" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1 min-w-0">
           <div className="flex items-center gap-2">
             <div className={cn("p-1.5 rounded-lg border", meta.colorClass)}>
               <Icon size={12} strokeWidth={2.5} />
             </div>
             <span className={cn("text-[9px] font-bold uppercase tracking-widest", meta.colorClass.split(' ')[0])}>
               {issue.category.replace(/_/g, " ")}
             </span>
           </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
           <Eye size={14} className="text-primary" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50 italic text-[12px] font-bold text-foreground/90 leading-relaxed group-hover:bg-background transition-colors">
          &ldquo;{issue.phrase}&rdquo;
        </div>
        <p className="text-[12px] text-foreground/80 leading-relaxed font-medium pl-1">
          {issue.explanation}
        </p>
      </div>

      {isHovered && (
        <div className="absolute top-0 right-0 p-2">
           <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      )}
    </div>
  );
}
