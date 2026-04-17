"use client";

import { useState } from "react";
import type { DiagnosisIssue } from "@/lib/anthropic/types";

// ─── Colour mapping ───────────────────────────────────────────────────────────

const HIGHLIGHT_BG: Record<"substance" | "style" | "trust", string> = {
  substance: "#FEF3C7",
  style: "#FCE7F3",
  trust: "#FEE2E2",
};

const LEGEND_ITEMS = [
  { label: "Substance", color: "#FEF3C7", border: "#FCD34D" },
  { label: "Style", color: "#FCE7F3", border: "#F9A8D4" },
  { label: "Trust", color: "#FEE2E2", border: "#FCA5A5" },
] as const;

// ─── Segment types ────────────────────────────────────────────────────────────

interface PlainSegment {
  type: "plain";
  text: string;
}
interface HighlightSegment {
  type: "highlight";
  text: string;
  issue: DiagnosisIssue;
}
type Segment = PlainSegment | HighlightSegment;

// ─── Build segments from flat text + issues ───────────────────────────────────

function buildSegments(text: string, issues: DiagnosisIssue[]): Segment[] {
  const sorted = [...issues].sort((a, b) => a.char_start - b.char_start);
  const segments: Segment[] = [];
  let pos = 0;

  for (const issue of sorted) {
    const start = Math.max(issue.char_start, pos);
    const end = issue.char_end;
    if (start >= end) continue;
    if (start > pos) {
      segments.push({ type: "plain", text: text.slice(pos, start) });
    }
    segments.push({
      type: "highlight",
      text: text.slice(start, end),
      issue,
    });
    pos = end;
  }

  if (pos < text.length) {
    segments.push({ type: "plain", text: text.slice(pos) });
  }

  return segments;
}

// ─── Render text with newline support ─────────────────────────────────────────

function renderWithNewlines(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OriginalPanelProps {
  content: string;
  issues: DiagnosisIssue[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OriginalPanel({ content, issues }: OriginalPanelProps) {
  const segments = buildSegments(content, issues);
  // Mobile: which issue's bottom sheet is open
  const [activeIssue, setActiveIssue] = useState<DiagnosisIssue | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Original
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[12px] leading-relaxed text-gray-900 dark:text-gray-100">
          {segments.map((seg, i) => {
            if (seg.type === "plain") {
              return <span key={i}>{renderWithNewlines(seg.text)}</span>;
            }
            const bg = HIGHLIGHT_BG[seg.issue.priority];
            return (
              /* Desktop: tooltip via title; Mobile: tap to open bottom sheet */
              <span
                key={i}
                title={seg.issue.explanation}
                style={{ backgroundColor: bg }}
                className="rounded-[2px] cursor-pointer lg:cursor-default"
                onClick={() => setActiveIssue(seg.issue)}
              >
                {seg.text}
              </span>
            );
          })}
        </p>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-gray-200 dark:border-gray-800 flex items-center gap-4">
        {LEGEND_ITEMS.map(({ label, color, border }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-[2px] flex-shrink-0"
              style={{ backgroundColor: color, border: `1px solid ${border}` }}
            />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile bottom sheet */}
      {activeIssue && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          onClick={() => setActiveIssue(null)}
        >
          <div className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg">
            <p className="text-[12px] text-gray-900 dark:text-gray-100 leading-relaxed">
              {activeIssue.explanation}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              Tap anywhere to dismiss
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
