"use client";

import React, { useMemo } from "react";
import { diffWordsWithSpace } from "diff";
import type { CleanupParagraph } from "@/lib/anthropic/types";

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
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex items-center justify-between text-[12px] text-gray-500">
          <span>Word-level diff between the original and cleaned content.</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200" aria-hidden="true" />
              +{totals.added} chars added
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-rose-100 border border-rose-200" aria-hidden="true" />
              -{totals.removed} chars removed
            </span>
          </span>
        </div>

        <article
          className="prose prose-sm max-w-none font-serif text-[15px] leading-[1.75] text-gray-900"
          aria-label="Unified diff between original and cleaned content"
        >
          {segments.map((s) => (
            <p key={s.idx} className="mb-4">
              {s.pauseCard && (
                <span className="block mb-1 text-[10px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-0.5 w-fit">
                  Pause card · {s.pauseCard.user_answer ? "answered" : "skipped"}
                </span>
              )}
              {s.parts.map((part, i) => {
                if (part.added) {
                  return (
                    <span
                      key={i}
                      className="bg-emerald-50 text-emerald-900 rounded px-0.5"
                    >
                      {part.value}
                    </span>
                  );
                }
                if (part.removed) {
                  return (
                    <span
                      key={i}
                      className="bg-rose-50 text-rose-900 line-through rounded px-0.5"
                    >
                      {part.value}
                    </span>
                  );
                }
                return <span key={i}>{part.value}</span>;
              })}
              {s.unchanged && (
                <span className="ml-2 text-[10px] text-gray-400 font-sans">unchanged</span>
              )}
            </p>
          ))}
        </article>
      </div>
    </div>
  );
}
