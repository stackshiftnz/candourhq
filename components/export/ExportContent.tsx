"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  FileDown,
  Type,
  Copy,
  CheckCircle,
  ArrowLeft,
  Search,
  RefreshCw,
  TrendingUp,
  Award,
  ChevronRight,
  ShieldCheck,
  History,
  Sparkles,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScoreBanner } from "./ScoreBanner";
import { DownloadCard } from "./DownloadCard";
import { WhatNextCard } from "./WhatNextCard";
import { ProvenanceRecordCard } from "./ProvenanceRecordCard";
import { ScoreBreakdownCard } from "./ScoreBreakdownCard";
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

  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" >("idle");
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
    toast("Rescoring is taking longer than expected.", "error");
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

  const handleCopy = async () => {
    if (!cleanup.final_content) return;
    try {
      await navigator.clipboard.writeText(cleanup.final_content);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
      toast("Content copied to clipboard", "success");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadReport = async (type: string) => {
    try {
      const response = await fetch(`/api/report?type=${type}&documentId=${doc.id}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `candour-report-${doc.id.substring(0, 8)}.${type === 'quality-report' ? 'pdf' : type}`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/["']/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      trackEvent("export_downloaded", doc.id, { format: type });
      toast(`${type.toUpperCase()} file ready`, "success");
    } catch (err) {
      console.error("Download error:", err);
      toast("Download failed. Please try again.", "error");
    }
  };

  const safeTitle = doc.title || "Untitled Document";
  const displayTitle = safeTitle.length > 25 ? safeTitle.substring(0, 22) + "..." : safeTitle;

  return (
    <div className="flex flex-col h-full bg-background selection:bg-primary/20">
      {/* Header Section */}
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
                    FINALIZED
                 </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
                 Registry Access <ChevronRight size={10} className="opacity-40" /> {brandProfile?.name || "Standard Matrix"}
              </p>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/history">
            <Button variant="secondary" className="px-6 rounded-2xl font-bold h-12 shadow-inner">
               Audit History
            </Button>
          </Link>
          <Button 
            onClick={() => downloadReport("quality-report")}
            className="px-6 rounded-2xl font-bold h-12 bg-foreground text-background hover:scale-[1.02] transition-all shadow-xl shadow-black/10"
          >
             Download Certificate
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar bg-muted/20">
        <div className="max-w-[1400px] mx-auto p-8 lg:p-12">
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
             {/* Left Rail: Actions & Results */}
             <div className="xl:col-span-8 flex flex-col gap-12">
                
                {/* Performance Insight Banner */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3 px-2">
                         <Award size={18} className="text-primary" />
                         <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Optimization Synopsis</h2>
                      </div>
                      {biggestImprovement && (
                         <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 animate-in slide-in-from-right-4 duration-700">
                            <TrendingUp size={12} strokeWidth={3} />
                            <span className="text-[9px] font-bold uppercase tracking-widest">
                               Peak Delta: {biggestImprovement.label} (+{biggestImprovement.delta.toFixed(1)})
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

                   {rescoreError && (
                      <div className="flex items-center justify-between p-6 bg-accent/5 border border-accent/20 rounded-[32px] animate-in slide-in-from-top-4 duration-500">
                         <div className="flex items-center gap-4">
                            <RefreshCw className="text-accent animate-spin-slow" size={20} />
                            <p className="text-sm font-bold text-accent tracking-tight">Recalculation Latency: Systems utilizing predictive estimation values.</p>
                         </div>
                         <Button
                            variant="secondary"
                            size="md"
                            className="rounded-2xl font-bold h-11 border-accent/30 text-accent hover:bg-accent/10"
                            onClick={() => runRescore()}
                            disabled={rescoreLoading}
                         >
                            {rescoreLoading ? "Recalculating..." : "Force Sync"}
                         </Button>
                      </div>
                   )}
                </div>

                {/* Export Vectors */}
                <section className="space-y-6">
                   <div className="flex items-center gap-3 px-2">
                      <Zap size={18} className="text-primary/40 text-primary" fill="currentColor" />
                      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Final Delivery Vectors</h2>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <DownloadCard 
                         icon={FileText}
                         iconBg="bg-primary/10"
                         iconColor="text-primary"
                         title="Dynamic Template"
                         description="Standard DOCX format. Full structural compatibility."
                         onClick={() => downloadReport("docx")}
                         primary
                      />
                      <DownloadCard 
                         icon={FileDown}
                         iconBg="bg-accent/10"
                         iconColor="text-accent"
                         title="Immutable PDF"
                         description="Visual snapshot. Locked for distribution."
                         onClick={() => downloadReport("pdf")}
                      />
                      <DownloadCard 
                         icon={Type}
                         iconBg="bg-green-500/10"
                         iconColor="text-green-500"
                         title="Unformatted Text"
                         description="Raw UTF-8. Safe for manual system entry."
                         onClick={() => downloadReport("txt")}
                      />
                      <DownloadCard 
                         icon={copyStatus === "copied" ? CheckCircle : Copy}
                         iconBg={copyStatus === "copied" ? "bg-green-500/10" : "bg-secondary/10"}
                         iconColor={copyStatus === "copied" ? "text-green-500" : "text-secondary"}
                         title={copyStatus === "copied" ? "Copied" : "Clipboard Capture"}
                         description="Instant relay to email or CMS systems."
                         onClick={handleCopy}
                      />
                   </div>
                </section>

                {/* Provenance Secondary Actions (Mobile only) */}
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
                      wordCount={doc.word_count || 0}
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

                {/* Next Steps Interface */}
                <section className="space-y-6 pt-12 border-t border-border">
                   <div className="flex items-center gap-3 px-2">
                      <Sparkles size={18} className="text-primary" />
                      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">What happens next</h2>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <WhatNextCard 
                         subLabel="Initialize"
                         title="New Process →"
                         href="/new"
                      />
                      <WhatNextCard 
                         subLabel="Retrieve"
                         title="Audit Vault →"
                         href="/history"
                      />
                      <WhatNextCard 
                         subLabel="Calibrate"
                         title="Identity Matrix →"
                         href="/settings/brand"
                      />
                   </div>
                </section>
             </div>

             {/* Right Rail: Meta Records (Desktop Only) */}
             <aside className="hidden xl:flex xl:col-span-4 flex-col gap-12 h-fit lg:sticky lg:top-36">
                
                <section className="space-y-6">
                   <div className="flex items-center gap-3 px-2">
                      <History size={16} className="text-muted-foreground opacity-40" />
                      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Performance Pass</h2>
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
                      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Immutable Context</h2>
                   </div>
                   <ProvenanceRecordCard 
                      title={safeTitle}
                      contentType={doc.content_type || "Document"}
                      wordCount={doc.word_count || 0}
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
