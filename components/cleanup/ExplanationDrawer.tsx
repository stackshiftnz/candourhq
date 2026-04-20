"use client";

import { ChangeTag } from "@/lib/anthropic/types";
import { cn } from "@/lib/utils";
import { X, Info, Sparkles, Command, ArrowDown } from "lucide-react";

interface ExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tag: ChangeTag | null;
}

export function ExplanationDrawer({ isOpen, onClose, tag }: ExplanationDrawerProps) {
  if (!isOpen || !tag) return null;

  return (
    <>
      {/* Premium Backdrop */}
      <div
        className="fixed inset-0 bg-background/40 backdrop-blur-sm z-[100] animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* Modern Side Drawer */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 md:top-0 md:left-auto md:w-[360px] bg-card border-t md:border-t-0 md:border-l border-border shadow-2xl z-[101] flex flex-col max-h-[85vh] md:max-h-none transition-all duration-500 ease-out",
          "animate-in slide-in-from-bottom md:slide-in-from-right",
          "rounded-t-[32px] md:rounded-t-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 h-20 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Sparkles size={18} />
             </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Change Logic</span>
                 <h2 className="text-sm font-bold text-foreground">
                   {tag.tag.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                 </h2>
              </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded-full transition-all text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar">
          {/* Original Context */}
          <div className="space-y-4 group">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground transition-colors" />
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Original Input</h3>
            </div>
            <div className="bg-muted/50 border border-border rounded-2xl p-5 text-[13px] text-muted-foreground italic leading-relaxed font-medium">
              &ldquo;{tag.original_phrase}&rdquo;
            </div>
          </div>

          <div className="flex justify-center -my-6 relative z-10">
             <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-lg text-muted-foreground">
                <ArrowDown size={14} />
             </div>
          </div>

          {/* Cleaned Result */}
          <div className="space-y-4 group">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                 <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest">Woven Output</h3>
             </div>
             <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-[14px] text-foreground font-bold leading-relaxed shadow-sm shadow-primary/5">
               &ldquo;{tag.cleaned_phrase}&rdquo;
             </div>
          </div>

          {/* Reasoning */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 px-1">
               <Info size={14} className="text-muted-foreground opacity-50" />
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Strategic Insight</h3>
            </div>
            <div className="p-5 rounded-3xl bg-secondary/5 border border-secondary/10">
               <p className="text-[13px] text-foreground/90 leading-relaxed font-medium">
                 {tag.explanation}
               </p>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-8 border-t border-border bg-muted/20">
            <button 
              onClick={onClose}
              className="w-full h-12 rounded-2xl bg-foreground text-background font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/5"
            >
              Close Explanation
            </button>
        </div>
      </div>
    </>
  );
}
