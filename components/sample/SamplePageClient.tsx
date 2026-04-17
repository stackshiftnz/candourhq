"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { CleanupParagraph } from "@/types/database";
import type { DiagnosisResponse } from "@/lib/anthropic/types";
import { logSampleEvent } from "@/app/actions/sample";
import { OriginalPanel } from "./OriginalPanel";
import { DiagnosisPanel } from "./DiagnosisPanel";
import { CleanedPanel } from "./CleanedPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = "original" | "diagnosis" | "cleaned";

interface SampleData {
  title: string;
  content: string;
  paragraphs: CleanupParagraph[];
  diagnosis: DiagnosisResponse;
}

interface SamplePageClientProps {
  userId: string;
  sample: SampleData;
  isSkipPath: boolean;
}

// ─── Skip banner ──────────────────────────────────────────────────────────────

function SkipBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
      <p className="text-[12px] text-amber-800 dark:text-amber-200 leading-snug">
        Your brand profile isn&apos;t set up yet. Candour is using default
        settings.{" "}
        <Link
          href="/onboarding"
          className="underline hover:no-underline font-medium"
        >
          Complete setup →
        </Link>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss banner"
        className="flex-shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors text-[14px] leading-none"
      >
        ×
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const BANNER_KEY = "candour_skip_banner_dismissed";

export function SamplePageClient({
  userId,
  sample,
  isSkipPath,
}: SamplePageClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("original");
  const [bannerDismissed, setBannerDismissed] = useState(true); // start hidden until effect runs
  const cleanedPanelRef = useRef<HTMLDivElement>(null);

  // Read sessionStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const dismissed = sessionStorage.getItem(BANNER_KEY) === "1";
    setBannerDismissed(dismissed);
  }, []);

  function dismissBanner() {
    sessionStorage.setItem(BANNER_KEY, "1");
    setBannerDismissed(true);
  }

  const handleEvent = useCallback(
    (type: string, meta?: Record<string, string>) => {
      logSampleEvent(userId, type, meta);
    },
    [userId]
  );

  function handleTabSwitch(tab: ActiveTab) {
    setActiveTab(tab);
    handleEvent("tab_switch", { tab });
  }

  function handleStartCleanup() {
    setActiveTab("cleaned");
    // Scroll to top of cleaned panel on mobile
    if (cleanedPanelRef.current) {
      cleanedPanelRef.current.scrollTop = 0;
    }
    handleEvent("tab_switch", { tab: "cleaned" });
  }

  const showBanner = isSkipPath && !bannerDismissed;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* Skip banner */}
      {showBanner && <SkipBanner onDismiss={dismissBanner} />}

      {/* Page header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        {/* Left: title + badge */}
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
            {sample.title}
          </p>
          <span className="flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Sample content
          </span>
        </div>

        {/* Right: export (disabled on sample) */}
        <div className="flex-shrink-0 relative group">
          <button
            disabled
            className="h-8 px-3 text-[12px] font-medium rounded-lg bg-gray-900 text-white opacity-40 cursor-not-allowed"
          >
            Export
          </button>
          {/* Tooltip */}
          <div className="pointer-events-none absolute right-0 top-full mt-1.5 w-[200px] rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-snug px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            Paste your own content to export
          </div>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden flex-shrink-0 flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        {(["original", "diagnosis", "cleaned"] as ActiveTab[]).map((tab) => {
          const active = activeTab === tab;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabSwitch(tab)}
              className={[
                "flex-1 py-2.5 text-[12px] font-medium border-b-2 transition-colors",
                active
                  ? "border-gray-900 dark:border-white text-gray-900 dark:text-white bg-white dark:bg-gray-950"
                  : "border-transparent text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ── Desktop: three panels ── */}
        <div className="hidden lg:flex w-full">
          {/* Original — 260px */}
          <div className="w-[260px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            <OriginalPanel
              content={sample.content}
              issues={sample.diagnosis.issues}
            />
          </div>

          {/* Diagnosis — 220px */}
          <div className="w-[220px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            <DiagnosisPanel
              diagnosis={sample.diagnosis}
              onStartCleanup={handleStartCleanup}
            />
          </div>

          {/* Cleaned — flex */}
          <div className="flex-1 min-w-0 flex flex-col">
            <CleanedPanel
              paragraphs={sample.paragraphs}
              onEvent={handleEvent}
            />
          </div>
        </div>

        {/* ── Mobile: single active tab ── */}
        <div className="lg:hidden w-full flex flex-col">
          {activeTab === "original" && (
            <OriginalPanel
              content={sample.content}
              issues={sample.diagnosis.issues}
            />
          )}
          {activeTab === "diagnosis" && (
            <DiagnosisPanel
              diagnosis={sample.diagnosis}
              onStartCleanup={handleStartCleanup}
            />
          )}
          {activeTab === "cleaned" && (
            <div ref={cleanedPanelRef} className="flex flex-col h-full">
              <CleanedPanel
                paragraphs={sample.paragraphs}
                onEvent={handleEvent}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
