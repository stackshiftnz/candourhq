"use client";

import { useState, useRef, useEffect } from "react";
import { CleanupParagraph as CleanupParagraphType, ChangeTag } from "@/lib/anthropic/types";
import { PauseCard } from "./PauseCard";
import { InlineTagExplanation } from "./InlineTagExplanation";
import { cn } from "@/lib/utils";
import { Pencil, Undo2, Sparkles, Info } from "lucide-react";

interface CleanupParagraphProps {
  paragraph: CleanupParagraphType;
  index: number;
  expandedTagKey: string | null;
  onTagExpand: (key: string | null) => void;
  onEdit: (index: number, newText: string) => void;
  onResolvePause: (index: number, answer: string | null, skipped: boolean) => void;
  hasUserEdit: boolean;
  onRevert?: (index: number) => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  savedFacts: { label: string; value: string }[];
}

const TAG_STYLES: Record<string, string> = {
  tightened: "bg-primary/8 text-primary border-primary/20",
  made_specific: "bg-amber-500/8 text-amber-600 border-amber-500/20",
  hedge_removed: "bg-accent/8 text-accent border-accent/20",
  brand_voice: "bg-green-500/8 text-green-600 border-green-500/20",
  cliche_removed: "bg-pink-500/8 text-pink-600 border-pink-500/20",
  softened: "bg-muted text-muted-foreground border-border",
  fact_added: "bg-blue-500/8 text-blue-600 border-blue-500/20",
};

export function CleanupParagraph({
  paragraph,
  index,
  expandedTagKey,
  onTagExpand,
  onEdit,
  onResolvePause,
  hasUserEdit,
  onRevert,
  onHoverIn,
  onHoverOut,
  savedFacts,
}: CleanupParagraphProps) {
  const [localText, setLocalText] = useState(paragraph.cleaned || "");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paragraph.cleaned !== null && paragraph.cleaned !== undefined) {
      setLocalText(paragraph.cleaned);
      if (contentRef.current && contentRef.current.innerText !== paragraph.cleaned) {
        contentRef.current.innerText = paragraph.cleaned;
      }
    }
  }, [paragraph.cleaned]);

  if (paragraph.type === "pause") {
    return (
      <div
        id={`paragraph-${index}`}
        className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        onMouseEnter={onHoverIn}
        onMouseLeave={onHoverOut}
      >
        <PauseCard
          paragraph={paragraph}
          onResolve={(answer, skipped) => onResolvePause(index, answer, skipped)}
          savedFacts={savedFacts}
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
      className="group relative mb-6 p-4 -mx-4 rounded-2xl transition-all duration-300 hover:bg-muted/30 animate-in fade-in slide-in-from-bottom-4 duration-500"
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
            {index + 1}
          </div>
          {hasUserEdit && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold uppercase tracking-widest text-amber-600">
              <Pencil size={8} /> Edited
            </div>
          )}
        </div>

        {hasUserEdit && onRevert && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRevert(index);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg"
          >
            <Undo2 size={10} /> Revert
          </button>
        )}
      </div>

      {/* Editable text */}
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleInput}
        onClick={(e) => e.stopPropagation()}
        className="text-[15px] lg:text-[16px] font-medium leading-relaxed tracking-tight text-foreground focus:outline-none rounded-lg p-1 -mx-1 cursor-text caret-primary"
      >
        {localText}
      </div>

      {/* Change tags */}
      {paragraph.changes && paragraph.changes.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {paragraph.changes.map((change, i) => {
              const tagKey = `${index}-${i}`;
              const isOpen = expandedTagKey === tagKey;
              return (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagExpand(isOpen ? null : tagKey);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[9px] font-bold transition-all",
                    TAG_STYLES[change.tag] || TAG_STYLES.softened,
                    isOpen && "ring-1 ring-current"
                  )}
                >
                  <Sparkles size={8} className="opacity-50" />
                  {change.tag.replace(/_/g, " ")}
                  <Info size={8} className="opacity-30" />
                </button>
              );
            })}
          </div>

          {/* Inline expansion for the active tag */}
          {paragraph.changes.map((change, i) => {
            const tagKey = `${index}-${i}`;
            if (expandedTagKey !== tagKey) return null;
            return (
              <InlineTagExplanation
                key={tagKey}
                tag={change}
                onClose={() => onTagExpand(null)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
