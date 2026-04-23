"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Copy,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Award,
  ChevronRight,
  ShieldCheck,
  History,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScoreBanner } from "./ScoreBanner";
import { WhatNextCard } from "./WhatNextCard";
import { ProvenanceRecordCard } from "./ProvenanceRecordCard";
import { ScoreBreakdownCard } from "./ScoreBreakdownCard";
import { StatsDashboard } from "./StatsDashboard";
import { FinalContentEditor } from "./FinalContentEditor";
import { Database } from "@/types/database";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useToast } from "@/lib/hooks/useToast";
import { trackEvent } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];
type Cleanup = Database["public"]["Tables"]["cleanups"]["Row"];
type BrandProfile = Database["public"]["Tables"]["brand_profiles"]["Row"];

interface ExportContentProps {
  document: Document;
  diagnosis: Diagnosis;
  cleanup: Cleanup;
  brandProfile: BrandProfile | null;
}

export default function ExportContent({
  document: doc,
  diagnosis,
  cleanup,
  brandProfile
}: ExportContentProps) {
  const [finalScores, setFinalScores] = useState<{
    substance: number;
    style: number;
    trust: number;
    average: number;
  } | null>(
    diagnosis.average_score_final !== null ? {
      substance: diagnosis.substance_score_final!,
      style: diagnosis.style_score_final!,
      trust: diagnosis.trust_score_final!,
      average: diagnosis.average_score_final!
    } : null
  );

  const { toast } = useToast();

  const action = useCallback(async () => {
    const res = await fetch("/api/rescore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id })
    });

    if (!res.ok) throw new Error("Rescore failed");

    const data = await res.json();
    if (data.scores) {
      setFinalScores(data.scores);
    } else {
      throw new Error("Invalid rescore response");
    }
  }, [doc.id]);

  const onTimeout = useCallback(() => {
    toast("Score calculation is taking longer than expected.", "error");
  }, [toast]);

  const { execute: runRescore, loading: rescoreLoading, error: rescoreError } = useAsyncAction(
    action,
    {
      timeoutMs: 55000,
      onTimeout
    }
  );

  const biggestImprovement = React.useMemo(() => {
    if (!finalScores) return null;
    const deltas = [
      { label: "Substance", delta: finalScores.substance - (diagnosis.substance_score || 0) },
      { label: "Style", delta: finalScores.style - (diagnosis.style_score || 0) },
      { label: "Trust", delta: finalScores.trust - (diagnosis.trust_score || 0) },
    ];
    const best = deltas.reduce((a, b) => (b.delta > a.delta ? b : a));
    if (best.delta <= 0) return null;
    return best;
  }, [finalScores, diagnosis.substance_score, diagnosis.style_score, diagnosis.trust_score]);

  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (diagnosis.average_score_final === null && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      runRescore();
    }
  }, [diagnosis.average_score_final, runRescore]);

  useEffect(() => {
    trackEvent("screen_view", doc.id, { screen: "export" });
  }, [doc.id]);

  const safeTitle = doc.title || "Untitled Document";
  const displayTitle = safeTitle.length > 25 ? safeTitle.substring(0, 22) + "..." : safeTitle;

  const cleanedWordCount = React.useMemo(() => {
    const text = cleanup.final_content || (() => {
      const paragraphs = (cleanup.paragraphs as unknown as Array<{ type: string; cleaned?: string; original?: string }>) || [];
      return paragraphs.map(p => {
        if (p.type === "clean") return p.cleaned || "";
        if (p.type === "pause") return p.original || "";
        return "";
      }).filter(Boolean).join("\n\n");
    })();
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [cleanup.final_content, cleanup.paragraphs]);

  return (
    <div className="flex flex-col h-full bg-background selection:bg-primary/20">
      {/* Header */}
      <header className="h-24 px-8 flex items-center justify-between border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-6">
          <Link href={`/clean/${doc.id}`} className="p-2.5 rounded-full hover:bg-muted transition-all active:scale-95 group">
            <ArrowLeft size={20} className="text-muted-foreground group-hover:text-foreground group-hover:-translate-x-1 transition-all" />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground">
                {displayTitle}
              </h1>
              <div className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[8px] font-bold tracking-widest text-primary">
                FINALISED
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
              Brand Profile <ChevronRight size={10} className="opacity-40" /> {brandProfile?.name || "Standard Profile"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/history">
            <Button variant="secondary" className="px-6 rounded-2xl font-bold h-12 shadow-inner">
              History
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar bg-muted/20">
        <div className="max-w-[1400px] mx-auto p-8 lg:p-12">

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            {/* Left Rail */}
            <div className="xl:col-span-8 flex flex-col gap-12">

              {/* Score summary */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3 px-2">
                    <Award size={18} className="text-primary" />
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quality Summary</h2>
                  </div>
                  {biggestImprovement && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 animate-in slide-in-from-right-4 duration-700">
                      <TrendingUp size={12} strokeWidth={3} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">
                        Biggest Improvement: {biggestImprovement.label} (+{biggestImprovement.delta.toFixed(1)})
                      </span>
                    </div>
                  )}
                </div>

                <ScoreBanner
                  originalScore={diagnosis.average_score_original || 0}
                  finalScore={finalScores?.average || null}
                  resolvedCount={cleanup.issues_resolved}
                  totalCount={cleanup.issues_total}
                  profileName={brandProfile?.name || "Standard Profile"}
                  rescoreError={!!rescoreError}
                />

                {!!rescoreError && (
                  <div className="flex items-center justify-between p-6 bg-accent/5 border border-accent/20 rounded-[32px] animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4">
                      <RefreshCw className="text-accent animate-spin-slow" size={20} />
                      <p className="text-sm font-bold text-accent tracking-tight">Score calculation failed — showing estimated values.</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="md"
                      className="rounded-2xl font-bold h-11 border-accent/30 text-accent hover:bg-accent/10"
                      onClick={() => runRescore()}
                      disabled={rescoreLoading}
                    >
                      {rescoreLoading ? "Recalculating…" : "Retry"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Statistics dashboard */}
              <StatsDashboard
                diagnosis={diagnosis}
                cleanup={cleanup}
                finalScores={finalScores}
                rescoreLoading={rescoreLoading}
                rescoreError={!!rescoreError}
              />

              {/* Final content editor */}
              <FinalContentEditor cleanup={cleanup} />

              {/* Mobile-only sidebar cards */}
              <div className="xl:hidden flex flex-col gap-12">
                <ScoreBreakdownCard
                  originalSubstance={diagnosis.substance_score || 0}
                  finalSubstance={finalScores?.substance || null}
                  originalStyle={diagnosis.style_score || 0}
                  finalStyle={finalScores?.style || null}
                  originalTrust={diagnosis.trust_score || 0}
                  finalTrust={finalScores?.trust || null}
                  originalAverage={diagnosis.average_score_original || 0}
                  finalAverage={finalScores?.average || null}
                  rescoreError={!!rescoreError}
                />
                <ProvenanceRecordCard
                  title={safeTitle}
                  contentType={doc.content_type || "Document"}
                  wordCount={cleanedWordCount}
                  language={brandProfile?.language_variant || doc.language_variant || "en-US"}
                  brandProfile={brandProfile?.name || "Standard Profile"}
                  issuesFound={cleanup.issues_total}
                  issuesResolved={cleanup.issues_resolved}
                  pauseCardsTotal={cleanup.pause_cards_total}
                  pauseCardsAnswered={cleanup.pause_cards_answered}
                  manualEditsCount={cleanup.user_edits?.length || 0}
                  exportedAt={doc.updated_at || new Date().toISOString()}
                />
              </div>

              {/* What's next */}
              <section className="space-y-6 pt-12 border-t border-border">
                <div className="flex items-center gap-3 px-2">
                  <Sparkles size={18} className="text-primary" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">What&apos;s next</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <WhatNextCard
                    subLabel="New"
                    title="Analyse New Document →"
                    href="/new"
                  />
                  <WhatNextCard
                    subLabel="Review"
                    title="History →"
                    href="/history"
                  />
                  <WhatNextCard
                    subLabel="Configure"
                    title="Brand Settings →"
                    href="/settings/brand"
                  />
                </div>
              </section>
            </div>

            {/* Right Rail (desktop only) */}
            <aside className="hidden xl:flex xl:col-span-4 flex-col gap-12 h-fit lg:sticky lg:top-36">

              <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <History size={16} className="text-muted-foreground opacity-40" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Score Breakdown</h2>
                </div>
                <ScoreBreakdownCard
                  originalSubstance={diagnosis.substance_score || 0}
                  finalSubstance={finalScores?.substance || null}
                  originalStyle={diagnosis.style_score || 0}
                  finalStyle={finalScores?.style || null}
                  originalTrust={diagnosis.trust_score || 0}
                  finalTrust={finalScores?.trust || null}
                  originalAverage={diagnosis.average_score_original || 0}
                  finalAverage={finalScores?.average || null}
                  rescoreError={!!rescoreError}
                />
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <ShieldCheck size={16} className="text-muted-foreground opacity-40" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Document Record</h2>
                </div>
                <ProvenanceRecordCard
                  title={safeTitle}
                  contentType={doc.content_type || "Document"}
                  wordCount={cleanedWordCount}
                  language={brandProfile?.language_variant || doc.language_variant || "en-US"}
                  brandProfile={brandProfile?.name || "Standard Profile"}
                  issuesFound={cleanup.issues_total}
                  issuesResolved={cleanup.issues_resolved}
                  pauseCardsTotal={cleanup.pause_cards_total}
                  pauseCardsAnswered={cleanup.pause_cards_answered}
                  manualEditsCount={cleanup.user_edits?.length || 0}
                  exportedAt={doc.updated_at || new Date().toISOString()}
                />
              </section>

            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
