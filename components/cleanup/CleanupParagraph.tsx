"use client";

import { useState, useRef, useEffect } from "react";
import { CleanupParagraph as CleanupParagraphType, ChangeTag } from "@/lib/anthropic/types";
import { PauseCard } from "./PauseCard";
import { cn } from "@/lib/utils";
import { 
  Pencil, 
  Undo2, 
  Eye, 
  EyeOff, 
  Info,
  Sparkles,
  Command,
  ArrowRight
} from "lucide-react";

interface CleanupParagraphProps {
  paragraph: CleanupParagraphType;
  index: number;
  isQueued: boolean;
  onEdit: (index: number, newText: string) => void;
  onTagClick: (tag: ChangeTag) => void;
  onResolvePause: (index: number, answer: string | null, skipped: boolean) => void;
  hasUserEdit: boolean;
  onRevert?: (index: number) => void;
}

const TAG_STYLES: Record<string, string> = {
  tightened: "bg-primary/10 text-primary border-primary/20",
  made_specific: "bg-secondary/10 text-secondary border-secondary/20",
  hedge_removed: "bg-accent/10 text-accent border-accent/20",
  brand_voice: "bg-green-500/10 text-green-500 border-green-500/20",
  cliche_removed: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  softened: "bg-muted text-muted-foreground border-border",
  fact_added: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

export function CleanupParagraph({
  paragraph,
  index,
  isQueued,
  onEdit,
  onTagClick,
  onResolvePause,
  hasUserEdit,
  onRevert
}: CleanupParagraphProps) {
  const [localText, setLocalText] = useState(paragraph.cleaned || "");
  const [showOriginal, setShowOriginal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paragraph.cleaned !== null) {
      setLocalText(paragraph.cleaned);
      if (contentRef.current && contentRef.current.innerText !== paragraph.cleaned) {
        contentRef.current.innerText = paragraph.cleaned;
      }
    }
  }, [paragraph.cleaned]);

  if (paragraph.type === "pause") {
    return (
      <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <PauseCard 
          paragraph={paragraph}
          onResolve={(answer, skipped) => onResolvePause(index, answer, skipped)}
        />
      </div>
    );
  }

  const handleInput = () => {
    if (contentRef.current) {
      onEdit(index, contentRef.current.innerText);
    }
  };

  return (
    <div 
      id={`paragraph-${index}`}
      className={cn(
        "group relative mb-12 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4",
        isQueued ? "opacity-30 blur-[0.5px] scale-[0.98]" : "opacity-100 scale-100"
      )}
    >
      <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-3">
            <div className={cn(
               "w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground transition-colors",
               !isQueued && "group-hover:bg-primary/10 group-hover:text-primary"
            )}>
               {index + 1}
            </div>
            {hasUserEdit && (
               <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/20 text-[9px] font-bold uppercase tracking-widest text-secondary">
                  <Pencil size={10} /> Custom Overlay
               </div>
            )}
         </div>

         <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {paragraph.original && (
               <button
                  onClick={() => setShowOriginal(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors hover:bg-muted rounded-lg"
               >
                  {showOriginal ? <EyeOff size={12} /> : <Eye size={12} />}
                  Reference
               </button>
            )}
            {hasUserEdit && onRevert && !isQueued && (
               <button
                  onClick={() => onRevert(index)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-primary/5 rounded-lg transition-all"
               >
                  <Undo2 size={12} /> Revert AI
               </button>
            )}
         </div>
      </div>

      <div className="relative">
         <div
            ref={contentRef}
            contentEditable={!isQueued}
            suppressContentEditableWarning
            onBlur={handleInput}
            className={cn(
               "text-lg lg:text-xl font-medium leading-relaxed tracking-tight text-foreground transition-all duration-300",
               "focus:outline-none focus:ring-4 focus:ring-primary/5 rounded-2xl p-4 -mx-4 group-hover:bg-muted/30",
               !isQueued ? "cursor-text caret-primary" : "cursor-default"
            )}
         >
            {localText}
         </div>
         
         {/* Focus ring indicator */}
         {!isQueued && (
            <div className="absolute left-[-20px] top-4 bottom-4 w-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
         )}
      </div>

      {showOriginal && paragraph.original && (
        <div className="mt-4 p-5 bg-card/50 border border-border rounded-3xl animate-in slide-in-from-top-2 duration-300 flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Command size={10} /> Historical Perspective
          </span>
          <p className="text-[14px] font-medium text-muted-foreground leading-relaxed italic opacity-70">
            {paragraph.original}
          </p>
        </div>
      )}

      {!isQueued && paragraph.changes && paragraph.changes.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
          {paragraph.changes.map((change, i) => (
            <button
              key={i}
              onClick={() => onTagClick(change)}
              className={cn(
                "group/tag inline-flex items-center gap-2 h-9 px-4 rounded-full border text-[10px] font-bold text-foreground transition-all hover:scale-105 active:scale-95",
                TAG_STYLES[change.tag] || TAG_STYLES.softened
              )}
            >
              <Sparkles size={10} className="opacity-40 group-hover/tag:opacity-100 transition-opacity" />
              {change.tag.replace(/_/g, " ")}
              <Info size={10} className="ml-1 opacity-20 group-hover/tag:opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
