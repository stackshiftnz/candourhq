"use client";

import { useState, useRef, useEffect } from "react";
import { CleanupParagraph as CleanupParagraphType, ChangeTag } from "@/lib/anthropic/types";
import { PauseCard } from "./PauseCard";
import { PencilIcon } from "lucide-react";

interface CleanupParagraphProps {
  paragraph: CleanupParagraphType;
  index: number;
  isQueued: boolean;
  onEdit: (index: number, newText: string) => void;
  onTagClick: (tag: ChangeTag) => void;
  onResolvePause: (index: number, answer: string | null, skipped: boolean) => void;
  hasUserEdit: boolean;
}

export function CleanupParagraph({
  paragraph,
  index,
  isQueued,
  onEdit,
  onTagClick,
  onResolvePause,
  hasUserEdit
}: CleanupParagraphProps) {
  const [localText, setLocalText] = useState(paragraph.cleaned || "");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paragraph.cleaned !== null) {
      setLocalText(paragraph.cleaned);
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
          <PencilIcon size={14} />
        </div>
      )}
      
      <div 
        ref={contentRef}
        contentEditable={!isQueued}
        suppressContentEditableWarning
        onBlur={handleInput}
        className={`text-[15px] leading-relaxed text-gray-900 focus:outline-none focus:bg-gray-50 rounded px-1 -mx-1 transition-colors ${!isQueued ? "cursor-text" : ""}`}
      >
        {localText}
      </div>

      {!isQueued && paragraph.changes && paragraph.changes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-500">
          {paragraph.changes.map((change, i) => (
            <button
              key={i}
              onClick={() => onTagClick(change)}
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
