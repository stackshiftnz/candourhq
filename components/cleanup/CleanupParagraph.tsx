"use client";

import { useState, useRef, useEffect } from "react";
import { CleanupParagraph as CleanupParagraphType, ChangeTag } from "@/lib/anthropic/types";
import { PauseCard } from "./PauseCard";
import { Pencil, Undo2, Eye, EyeOff } from "lucide-react";

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
      // contentEditable doesn't reliably re-render from React children when the
      // DOM has been mutated by the user; imperatively sync when the prop changes
      // (e.g. after a revert) and the DOM text diverges.
      if (contentRef.current && contentRef.current.innerText !== paragraph.cleaned) {
        contentRef.current.innerText = paragraph.cleaned;
      }
    }
  }, [paragraph.cleaned]);

  if (paragraph.type === "pause") {
    return (
      <div className="mb-8">
        <PauseCard 
          paragraph={paragraph}
          onResolve={(answer, skipped) => onResolvePause(index, answer, skipped)}
        />
      </div>
    );
  }

  const tagColours: Record<string, string> = {
    tightened: "bg-teal-50 text-teal-800 border-teal-100",
    made_specific: "bg-blue-50 text-blue-800 border-blue-100",
    hedge_removed: "bg-amber-50 text-amber-800 border-amber-100",
    brand_voice: "bg-purple-50 text-purple-800 border-purple-100",
    cliche_removed: "bg-pink-50 text-pink-800 border-pink-100",
    softened: "bg-gray-100 text-gray-600 border-gray-200",
    fact_added: "bg-green-50 text-green-800 border-green-100",
  };

  const handleInput = () => {
    if (contentRef.current) {
      onEdit(index, contentRef.current.innerText);
    }
  };

  return (
    <div 
      id={`paragraph-${index}`}
      className={`group relative mb-8 transition-opacity duration-300 ${isQueued ? "opacity-40 italic" : "opacity-100"}`}
    >
      {hasUserEdit && (
        <div className="absolute -left-6 top-1 text-gray-300" title="Manually edited">
          <Pencil size={14} />
        </div>
      )}
      <div className="absolute -top-1 right-0 flex items-center gap-1">
        {paragraph.original && (
          <button
            onClick={() => setShowOriginal(v => !v)}
            className="md:hidden flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-900 border border-gray-200 bg-white rounded-md"
            title="Toggle original paragraph"
            aria-label={showOriginal ? "Hide the original paragraph" : "Show the original paragraph"}
            aria-expanded={showOriginal}
          >
            {showOriginal ? <EyeOff size={11} aria-hidden="true" /> : <Eye size={11} aria-hidden="true" />}
            {showOriginal ? "Hide original" : "Show original"}
          </button>
        )}
        {hasUserEdit && onRevert && !isQueued && (
          <button
            onClick={() => onRevert(index)}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-900 border border-gray-200 bg-white rounded-md transition-opacity"
            title="Revert to Candour's cleaned version"
            aria-label={`Revert paragraph ${index + 1} to the Candour-cleaned version`}
          >
            <Undo2 size={11} aria-hidden="true" />
            Revert to AI version
          </button>
        )}
      </div>

      <div
        ref={contentRef}
        contentEditable={!isQueued}
        suppressContentEditableWarning
        onBlur={handleInput}
        role="textbox"
        aria-multiline="true"
        aria-readonly={isQueued}
        aria-label={`Cleaned paragraph ${index + 1}${hasUserEdit ? ", manually edited" : ""}`}
        tabIndex={isQueued ? -1 : 0}
        className={`text-[15px] leading-relaxed text-gray-900 focus:outline-none focus:bg-gray-50 rounded px-1 -mx-1 transition-colors ${!isQueued ? "cursor-text" : ""}`}
      >
        {localText}
      </div>

      {showOriginal && paragraph.original && (
        <div className="md:hidden mt-2 p-3 bg-gray-50 border-l-2 border-gray-200 rounded-r">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
            Original
          </span>
          <p className="text-[13px] text-gray-500 leading-relaxed whitespace-pre-wrap">
            {paragraph.original}
          </p>
        </div>
      )}

      {!isQueued && paragraph.changes && paragraph.changes.length > 0 && (
        <div
          className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-500"
          role="group"
          aria-label={`${paragraph.changes.length} change${paragraph.changes.length === 1 ? "" : "s"} applied to paragraph ${index + 1}`}
        >
          {paragraph.changes.map((change, i) => (
            <button
              key={i}
              onClick={() => onTagClick(change)}
              aria-label={`View explanation for ${change.tag.replace(/_/g, " ")} change`}
              className={`text-[12px] font-bold uppercase tracking-wider px-3 h-11 flex items-center justify-center rounded-full border cursor-pointer hover:brightness-95 transition-all ${tagColours[change.tag] || tagColours.softened}`}
            >
              {change.tag.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
