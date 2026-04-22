"use client";

import React from "react";
import { ChangeTag } from "@/lib/anthropic/types";
import { X, ArrowDown } from "lucide-react";

interface InlineTagExplanationProps {
  tag: ChangeTag;
  onClose: () => void;
}

const TAG_LABEL: Record<string, string> = {
  tightened: "Tightened",
  made_specific: "Made Specific",
  hedge_removed: "Hedge Removed",
  brand_voice: "Brand Voice",
  cliche_removed: "Cliché Removed",
  softened: "Softened",
  fact_added: "Fact Added",
};

export function InlineTagExplanation({ tag, onClose }: InlineTagExplanationProps) {
  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
          {TAG_LABEL[tag.tag] || tag.tag.replace(/_/g, " ")}
        </span>
        <button
          onClick={onClose}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <X size={10} />
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-[12px] text-foreground/50 font-medium italic leading-relaxed line-through">
          &ldquo;{tag.original_phrase}&rdquo;
        </p>
        <div className="flex justify-center py-0.5">
          <ArrowDown size={11} className="text-muted-foreground" />
        </div>
        <p className="text-[12px] text-foreground font-semibold leading-relaxed">
          &ldquo;{tag.cleaned_phrase}&rdquo;
        </p>
      </div>

      {tag.explanation && (
        <p className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
          {tag.explanation}
        </p>
      )}
    </div>
  );
}
