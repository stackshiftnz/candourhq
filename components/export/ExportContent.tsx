"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  FileTextIcon, 
  FileDownIcon, 
  TypeIcon, 
  CopyIcon, 
  CheckCircle2Icon,
  ArrowLeftIcon,
  SearchIcon,
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

  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
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

  const { execute: runRescore, error: rescoreError } = useAsyncAction(
    action,
    { onTimeout }
  );

  const hasTriggeredRef = useRef(false);

  // Trigger rescore on mount if not already done
  useEffect(() => {
    if (diagnosis.average_score_final === null && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      runRescore();
    }
  }, [diagnosis.average_score_final, runRescore]);

  const handleCopy = async () => {
    if (!cleanup.final_content) return;
    try {
      await navigator.clipboard.writeText(cleanup.final_content);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
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
      // Extract filename from header if possible, or use default
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
    } catch (err) {
      console.error("Download error:", err);
      toast("Download failed. Please try again.", "error");
    }
  };

  // Helper for title truncation on mobile
  const safeTitle = doc.title || "Untitled Document";
  const displayTitle = safeTitle.length > 20 ? safeTitle.substring(0, 17) + "..." : safeTitle;

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="h-16 border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 bg-white shrink-0">
        <div className="flex flex-col">
          <h1 className="text-[14px] font-bold text-gray-900 leading-tight lg:hidden">
            {displayTitle}
          </h1>
          <h1 className="hidden lg:block text-[14px] font-bold text-gray-900 leading-tight">
            {safeTitle}
          </h1>
          <p className="text-[12px] text-gray-400 font-medium">Export and save</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/clean/${doc.id}`}>
            <Button variant="secondary" size="sm" className="hidden sm:flex">
              <ArrowLeftIcon size={14} className="mr-2" />
              Clean-up
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="secondary" size="sm" className="hidden sm:flex">
              <SearchIcon size={14} className="mr-2" />
              View history
            </Button>
          </Link>
          <Link href="/history" className="sm:hidden">
            <Button variant="secondary" size="sm">History</Button>
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-[1200px] mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Main Actions */}
          <div className="flex-1">
            <ScoreBanner 
              originalScore={diagnosis.average_score_original || 0}
              finalScore={finalScores?.average || null}
              resolvedCount={cleanup.issues_resolved}
              totalCount={cleanup.issues_total}
              profileName={brandProfile?.name || "Standard Profile"}
            />

            <section className="mb-12">
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">
                Download your content
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DownloadCard 
                  icon={FileTextIcon}
                  iconBg="bg-green-100"
                  iconColor="text-green-700"
                  title="Word doc"
                  description="DOCX — opens in Word, Google Docs, or Notion"
                  onClick={() => downloadReport("docx")}
                  primary
                />
                <DownloadCard 
                  icon={FileDownIcon}
                  iconBg="bg-red-100"
                  iconColor="text-red-700"
                  title="PDF"
                  description="Ready to send or attach — not editable"
                  onClick={() => downloadReport("pdf")}
                />
                <DownloadCard 
                  icon={TypeIcon}
                  iconBg="bg-blue-100"
                  iconColor="text-blue-700"
                  title="Plain text"
                  description="TXT — paste into any tool or CMS"
                  onClick={() => downloadReport("txt")}
                />
                <DownloadCard 
                  icon={copyStatus === "copied" ? CheckCircle2Icon : CopyIcon}
                  iconBg="bg-purple-100"
                  iconColor={copyStatus === "copied" ? "text-green-600" : "text-purple-700"}
                  title={copyStatus === "copied" ? "Copied" : "Copy to clipboard"}
                  description="Paste straight into your email or CMS"
                  onClick={handleCopy}
                />
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">
                Provenance report
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm gap-4 transition-all hover:border-gray-300">
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-gray-900">Download quality report</span>
                  {rescoreError ? (
                    <p className="text-[13px] text-amber-600 font-medium mt-3 text-center">
                      Using estimated scores — recalculation failed.
                    </p>
                  ) : null}
                  <p className="text-[12px] text-gray-500 max-w-[450px]">
                    One-page PDF showing original scores, final scores, all issues found, changes applied, and brand profile used. Share with clients or keep on file.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => downloadReport("quality-report")}>
                  Download PDF
                </Button>
              </div>
            </section>section { /* Mobile only Provenance & Scores in main flow */ }
            <div className="lg:hidden flex flex-col gap-8 mb-12">
               <section>
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">
                    Provenance record
                  </h2>
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

               <section>
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">
                    Score breakdown
                  </h2>
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
            </div>

            <section>
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">
                What next
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <WhatNextCard 
                  subLabel="Analyse another"
                  title="New document →"
                  href="/new"
                />
                <WhatNextCard 
                  subLabel="Review past work"
                  title="View history →"
                  href="/history"
                />
                <WhatNextCard 
                  subLabel="Improve your profile"
                  title="Brand settings →"
                  href="/settings/brand"
                  className="col-span-2 lg:col-span-1"
                />
              </div>
            </section>
          </div>

          {/* Right Column: Record (Desktop Only) */}
          <aside className="hidden lg:flex flex-col gap-8 w-[280px] shrink-0 pt-0">
            <section>
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">
                Provenance record
              </h2>
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

            <section>
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">
                Score breakdown
              </h2>
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
          </aside>

        </div>
      </div>
    </div>
  );
}
