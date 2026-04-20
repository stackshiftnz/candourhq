"use client";

import React, { useMemo } from "react";
import { diffWordsWithSpace } from "diff";
import type { CleanupParagraph } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import { 
  PlusCircle, 
  MinusCircle, 
  Zap, 
  Sparkles,
  Command,
  FileSearch,
  Check
} from "lucide-react";

interface DiffViewProps {
  paragraphs: CleanupParagraph[];
}

function paragraphOriginal(p: CleanupParagraph): string {
  return p.original || "";
}

function paragraphCleaned(p: CleanupParagraph): string {
  if (p.type === "clean") return p.cleaned || p.original || "";
  if (p.type === "pause") return p.original || "";
  return "";
}

export function DiffView({ paragraphs }: DiffViewProps) {
  const segments = useMemo(() => {
    return paragraphs.map((p, idx) => {
      const before = paragraphOriginal(p);
      const after = paragraphCleaned(p);
      const parts = diffWordsWithSpace(before, after);
      const unchanged = parts.every((part) => !part.added && !part.removed);
      return { idx, parts, unchanged, pauseCard: p.type === "pause" ? p.pause_card : null };
    });
  }, [paragraphs]);

  const totals = useMemo(() => {
    let added = 0;
    let removed = 0;
    segments.forEach((s) => {
      s.parts.forEach((part) => {
        if (part.added) added += part.value.length;
        if (part.removed) removed += part.value.length;
      });
    });
    return { added, removed };
  }, [segments]);

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-12 py-10 bg-card/50">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Statistics Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 bg-background border border-border rounded-[28px] shadow-sm">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <FileSearch size={20} />
             </div>
             <div className="flex flex-col">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Delta Analysis</h3>
                <p className="text-[10px] font-medium text-muted-foreground/60 leading-none">Word-Level Lexical Transformation Mapping</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-500">
               <PlusCircle size={14} strokeWidth={3} />
               <span className="text-[11px] font-bold uppercase tracking-widest">+{totals.added} Chars</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent">
               <MinusCircle size={14} strokeWidth={3} />
               <span className="text-[11px] font-bold uppercase tracking-widest">-{totals.removed} Chars</span>
            </div>
          </div>
        </div>

        {/* Unified Document View */}
        <article
          className="bg-background border border-border rounded-[40px] p-10 lg:p-16 shadow-2xl shadow-black/5"
          aria-label="Unified diff display"
        >
          <div className="prose prose-lg max-w-none space-y-8">
            {segments.map((s) => (
              <div key={s.idx} className="group relative">
                {s.pauseCard && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-xl bg-secondary/10 border border-secondary/20 w-fit">
                    <Zap size={10} className="text-secondary" fill="currentColor" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                      Intervention • {s.pauseCard.user_answer ? "Integrated" : "Bypassed"}
                    </span>
                  </div>
                )}
                
                <p className="text-lg lg:text-xl font-medium leading-relaxed tracking-tight text-foreground transition-colors">
                  {s.parts.map((part, i) => {
                    if (part.added) {
                      return (
                        <span
                          key={i}
                          className="bg-green-500/20 text-foreground rounded-md px-1.5 py-0.5 border-b-2 border-green-500 transition-all shadow-sm mx-0.5"
                        >
                          {part.value}
                        </span>
                      );
                    }
                    if (part.removed) {
                      return (
                        <span
                          key={i}
                          className="bg-accent/10 text-accent/50 line-through rounded-md px-1 mx-0.5"
                        >
                          {part.value}
                        </span>
                      );
                    }
                    return <span key={i} className="opacity-90">{part.value}</span>;
                  })}
                  
                  {s.unchanged && (
                    <span className="group-hover:opacity-100 opacity-0 ml-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[8px] font-bold uppercase tracking-widest text-muted-foreground transition-all">
                       <Check size={8} strokeWidth={4} /> Validated
                    </span>
                  )}
                </p>
                
                {/* Horizontal divider between paragraphs except last */}
                {s.idx < segments.length - 1 && (
                   <div className="mt-8 border-t border-border/50 group-hover:border-primary/20 transition-colors w-1/4" />
                )}
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
