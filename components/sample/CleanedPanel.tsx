"use client";

import { useState } from "react";
import Link from "next/link";
import type { CleanupParagraph, ChangeTag } from "@/types/database";
import { Button } from "@/components/ui/Button";

// ─── Change tag colours ───────────────────────────────────────────────────────

const TAG_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  tightened: { bg: "#E1F5EE", text: "#085041", label: "tightened" },
  made_specific: { bg: "#E6F1FB", text: "#0C447C", label: "made specific" },
  hedge_removed: { bg: "#FEF3C7", text: "#633806", label: "hedge removed" },
  brand_voice: { bg: "#EEEDFE", text: "#3C3489", label: "brand voice" },
  fact_added: { bg: "#EAF3DE", text: "#27500A", label: "fact added" },
  cliche_removed: { bg: "#FCE7F3", text: "#831843", label: "cliché removed" },
  softened: { bg: "#FEF3C7", text: "#633806", label: "softened" },
};

function defaultStyle(tag: string) {
  return TAG_STYLE[tag] ?? { bg: "#F3F4F6", text: "#374151", label: tag };
}

// ─── Change tag pill ──────────────────────────────────────────────────────────

function TagPill({
  change,
  onClick,
}: {
  change: ChangeTag;
  onClick: () => void;
}) {
  const style = defaultStyle(change.tag);
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ml-1.5 cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </button>
  );
}

// ─── Change drawer / sheet ────────────────────────────────────────────────────

function ChangeDrawer({
  change,
  onClose,
}: {
  change: ChangeTag;
  onClose: () => void;
}) {
  const style = defaultStyle(change.tag);
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Desktop drawer */}
      <div className="hidden lg:flex fixed right-0 top-0 bottom-0 w-[300px] z-40 flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: style.bg, color: style.text }}
          >
            {style.label}
          </span>
          <button
            onClick={onClose}
            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
              What changed
            </p>
            <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {change.explanation}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
              Before
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed line-through">
              {change.original_phrase}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
              After
            </p>
            <p className="text-[12px] text-gray-900 dark:text-gray-100 leading-relaxed">
              {change.cleaned_phrase}
            </p>
          </div>
        </div>
      </div>
      {/* Mobile bottom sheet */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-xl px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: style.bg, color: style.text }}
          >
            {style.label}
          </span>
          <button
            onClick={onClose}
            className="text-[11px] text-gray-400 hover:text-gray-600"
          >
            Dismiss
          </button>
        </div>
        <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          {change.explanation}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-gray-400 mb-1">Before</p>
            <p className="text-[11px] text-gray-500 line-through leading-relaxed">
              {change.original_phrase}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-1">After</p>
            <p className="text-[11px] text-gray-900 dark:text-gray-100 leading-relaxed">
              {change.cleaned_phrase}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Pause card ───────────────────────────────────────────────────────────────

function PauseCard({
  question,
  hint,
  onSubmit,
  onSkip,
}: {
  question: string;
  hint: string;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="rounded-[10px] border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 my-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
        Missing fact — your input needed
      </p>
      <p className="text-[13px] text-gray-900 dark:text-gray-100 leading-relaxed mb-3">
        {question}
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
        }}
        placeholder={hint}
        className="w-full text-[13px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-600 mb-3"
      />
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!value.trim()}
          onClick={() => onSubmit(value.trim())}
        >
          Add fact and continue
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Skip this one
        </button>
      </div>
    </div>
  );
}

// ─── CTA card ─────────────────────────────────────────────────────────────────

function CtaCard({ onLog }: { onLog: () => void }) {
  return (
    <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-5 mt-4 bg-gray-50 dark:bg-gray-900">
      <p className="text-[14px] font-medium text-gray-900 dark:text-white mb-1">
        Ready to try your own content?
      </p>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
        Paste anything — an email draft, a blog post, a proposal. Candour will
        diagnose and clean it using your brand profile.
      </p>
      <Link href="/new" onClick={onLog}>
        <Button variant="primary" className="w-full">
          Paste your own content
        </Button>
      </Link>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CleanedPanelProps {
  paragraphs: CleanupParagraph[];
  onEvent: (type: string, meta?: Record<string, string>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CleanedPanel({ paragraphs, onEvent }: CleanedPanelProps) {
  const [pauseInput, setPauseInput] = useState("");
  const [pauseResolved, setPauseResolved] = useState(false);
  const [para3Accepted, setPara3Accepted] = useState(false);
  const [allAccepted, setAllAccepted] = useState(false);
  const [openChange, setOpenChange] = useState<ChangeTag | null>(null);

  const total = 4;
  const resolved =
    1 + // para 1 pre-applied
    (pauseResolved ? 1 : 0) +
    (para3Accepted || allAccepted ? 2 : 0);

  const progressPct = Math.round((resolved / total) * 100);
  const isComplete = allAccepted || (pauseResolved && para3Accepted);

  function handlePauseSubmit(answer: string) {
    setPauseInput(answer);
    setPauseResolved(true);
    onEvent("pause_card_answered");
  }

  function handlePauseSkip() {
    setPauseInput("");
    setPauseResolved(true);
    onEvent("pause_card_skipped");
  }

  function handleAcceptAll() {
    setPauseResolved(true);
    setPara3Accepted(true);
    setAllAccepted(true);
    onEvent("accept_all");
  }

  // Get the para 2 resolved cleaned text
  function para2CleanedText(): string {
    if (!pauseResolved) return "";
    if (pauseInput) {
      return `AI adoption in your context delivered ${pauseInput}. When planned carefully, it can produce measurable returns — your experience is a strong proof point.`;
    }
    // Skipped: soften the claim
    return `AI can deliver meaningful business improvements when implemented carefully. Results vary by context — consider what success looks like for your specific use case.`;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Cleaned
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0">
        {paragraphs.map((para, i) => (
          <div key={i} className={i > 0 ? "mt-4" : ""}>
            {para.type === "clean" && (
              <div>
                <p className="text-[13px] text-gray-900 dark:text-gray-100 leading-relaxed inline">
                  {para.cleaned}
                </p>
                {para.changes.map((change, ci) => (
                  <TagPill
                    key={ci}
                    change={change}
                    onClick={() => {
                      setOpenChange(change);
                      onEvent("tag_click", { tag: change.tag });
                    }}
                  />
                ))}
                {/* Para 3 accept button (before accept all) */}
                {i === 2 && !para3Accepted && !allAccepted && (
                  <button
                    type="button"
                    onClick={() => {
                      setPara3Accepted(true);
                      onEvent("accept_paragraph");
                    }}
                    className="block mt-2 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline transition-colors"
                  >
                    Accept these changes
                  </button>
                )}
              </div>
            )}

            {para.type === "pause" && !pauseResolved && para.pause_card && (
              <PauseCard
                question={para.pause_card.question}
                hint={para.pause_card.hint}
                onSubmit={handlePauseSubmit}
                onSkip={handlePauseSkip}
              />
            )}

            {para.type === "pause" && pauseResolved && (
              <div>
                <p className="text-[13px] text-gray-900 dark:text-gray-100 leading-relaxed inline">
                  {para2CleanedText()}
                </p>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ml-1.5"
                  style={
                    pauseInput
                      ? { backgroundColor: "#EAF3DE", color: "#27500A" }
                      : { backgroundColor: "#FEF3C7", color: "#633806" }
                  }
                >
                  {pauseInput ? "fact added" : "softened"}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* CTA card — shown once all resolved */}
        {isComplete && (
          <CtaCard onLog={() => onEvent("try_own_content_clicked")} />
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
        {/* Progress */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {resolved} of {total} issues resolved
          </p>
          <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-900 dark:bg-white transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        {/* Accept all */}
        {!isComplete && (
          <Button variant="secondary" size="sm" onClick={handleAcceptAll}>
            Accept all
          </Button>
        )}
      </div>

      {/* Drawer / sheet */}
      {openChange && (
        <ChangeDrawer
          change={openChange}
          onClose={() => setOpenChange(null)}
        />
      )}
    </div>
  );
}
