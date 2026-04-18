"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { DiagnosisResponse, DiagnosisIssue } from "@/lib/anthropic/types";
import { HighlightText } from "@/components/analyse/HighlightText";
import { SignalBlock } from "@/components/analyse/SignalBlock";
import { IssueCard } from "@/components/analyse/IssueCard";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/hooks/useToast";
import { Tabs } from "@/components/ui/Tabs";
import { getWordCount } from "@/lib/utils/word-count";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];

export default function DiagnosisPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [doc, setDoc] = useState<Document | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scores");
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [takingLong, setTakingLong] = useState(false);
  const [analysisState, setAnalysisState] = useState<"loading" | "error" | "done">("loading");

  const pollingStartTime = useRef(Date.now());
  const autoTriggerFired = useRef(false);
  const POLLING_TIMEOUT_MS = 90_000;

  // For scrolling bidirectional
  const originalColumnRef = useRef<HTMLDivElement>(null);
  const issuesColumnRef = useRef<HTMLDivElement>(null);

  const fetchDocument = useCallback(async () => {
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (docError || !doc) {
      setError("Document not found");
      setLoading(false);
      return;
    }

    setDoc(doc);

    // If diagnosed, fetch the diagnosis
    if (doc.status === "diagnosed") {
      const { data: diag } = await supabase
        .from("diagnoses")
        .select("*")
        .eq("document_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (diag) setDiagnosis(diag);
      setLoading(false);
    } else if (doc.status === "pending") {
      // Auto-trigger analysis — guard against double-fire (React strict mode,
      // multi-tab, navigation returns) with a ref and a cross-tab sessionStorage lock.
      const lockKey = `analyse-trigger:${id}`;
      if (autoTriggerFired.current) return;
      if (typeof window !== "undefined" && sessionStorage.getItem(lockKey)) return;

      autoTriggerFired.current = true;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(lockKey, Date.now().toString());
      }

      try {
        await fetch("/api/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: id }),
        });
      } catch (e) {
        console.error("Failed to trigger analysis", e);
      }
    }
  }, [id, supabase]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handleError = useCallback(async () => {
    setAnalysisState("error");
    toast("Analysis failed. Your content has been saved — try again from History.", "error");

    // Clear trigger lock so the user can retry
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`analyse-trigger:${id}`);
    }
    autoTriggerFired.current = false;

    // Revert status to pending
    await supabase
      .from("documents")
      .update({ status: "pending" })
      .eq("id", id);
  }, [id, supabase, toast]);

  // Polling logic
  useEffect(() => {
    if (!doc || (doc.status !== "analysing" && doc.status !== "pending")) {
      return;
    }

    pollingStartTime.current = Date.now();

    const timer = setInterval(async () => {
      const elapsed = Date.now() - pollingStartTime.current;

      if (elapsed > POLLING_TIMEOUT_MS) {
        clearInterval(timer);
        handleError();
        return;
      }

      const { data: polledDoc } = await supabase
        .from("documents")
        .select("status")
        .eq("id", id)
        .single();

      if (polledDoc?.status === "diagnosed") {
        fetchDocument();
        setAnalysisState("done");
        clearInterval(timer);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`analyse-trigger:${id}`);
        }
      }

      if (elapsed > 20_000) {
        setTakingLong(true);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [doc, id, supabase, fetchDocument, handleError, POLLING_TIMEOUT_MS]);

  const handleRetry = useCallback(async () => {
    pollingStartTime.current = Date.now();
    setAnalysisState("loading");
    setTakingLong(false);
    try {
      await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      // Refetch doc to restart the polling effect
      fetchDocument();
    } catch (e) {
      console.error("Retry failed", e);
      setAnalysisState("error");
    }
  }, [id, fetchDocument]);



  const handleStartCleanup = async () => {
    if (!doc) return;
    setIsCleaning(true);
    
    try {
      // 1. Update status to cleaning
      await supabase
        .from("documents")
        .update({ status: "cleaning" })
        .eq("id", id);
      
      // 2. Call api/clean (currently 501, but we follow the plan)
      const res = await fetch("/api/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });

      if (res.ok) {
        router.push(`/clean/${id}`);
      } else {
        // Fallback or error handled by UI
        console.warn("Clean API returned error/not implemented", await res.text());
        // For now, since we know it's 501, we might just stay here or show an error
        setIsCleaning(false);
        setError("Cleanup function not yet available.");
      }
    } catch (e) {
      console.error("Cleanup failed", e);
      setIsCleaning(false);
    }
  };

  const scrollToIssue = (issueId: string) => {
    const card = document.getElementById(`card-${issueId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHoveredIssueId(issueId);
  };

  const scrollToHighlight = (issueId: string) => {
    const highlight = document.getElementById(`highlight-${issueId}`);
    if (highlight) {
      highlight.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHoveredIssueId(issueId);
  };

  if (analysisState === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 text-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-gray-300">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2"/>
          <path d="M20 12v10M20 28h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h2 className="text-sm font-medium text-gray-900">Analysis failed</h2>
        <p className="text-xs text-gray-500 max-w-xs">
          Something went wrong analysing your content. Your document has been saved.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRetry}
            className="flex items-center justify-center h-11 px-4 text-[13px] font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Try again
          </button>
          <Link
            href="/new"
            className="flex items-center justify-center h-11 px-4 text-[13px] font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            New document
          </Link>
        </div>
      </div>
    );
  }

  if (loading || (doc?.status === "analysing" || doc?.status === "pending")) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-16 h-16 relative">
          <Spinner size="lg" className="text-gray-900 dark:text-white" />
          <div className="absolute inset-0 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-[15px] font-medium text-gray-900 dark:text-white">
            Analysing your content...
          </h2>
          <p className="text-[13px] text-gray-500 mt-1">
            {takingLong ? "This is taking a little longer than usual — almost there." : "Checking for style, substance, and trust."}
          </p>
        </div>

        {/* Loading Skeletons */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col h-full space-y-4 bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
                <Spinner size="sm" />
              </div>
              <div className="flex-1 h-32 bg-gray-50/50 dark:bg-gray-950/50 rounded-xl" />
              <div className="h-10 bg-gray-50/50 dark:bg-gray-950/50 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !doc || !diagnosis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-500 font-medium">{error || "Something went wrong"}</p>
        <Button 
          variant="secondary" 
          className="mt-4"
          onClick={() => { setError(null); setLoading(true); fetchDocument(); }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const data: DiagnosisResponse = {
    headline_finding: diagnosis.headline_finding,
    signals: {
      substance: {
        score: diagnosis.substance_score,
        description: diagnosis.substance_desc || "",
        dimensions: {
          specificity: diagnosis.specificity_score,
          evidence: diagnosis.evidence_score,
          information_density: diagnosis.info_density_score,
        }
      },
      style: {
        score: diagnosis.style_score,
        description: diagnosis.style_desc || "",
        dimensions: {
          generic_phrasing: diagnosis.generic_phrasing_score,
          repetition: diagnosis.repetition_score,
          readability: diagnosis.readability_score,
        }
      },
      trust: {
        score: diagnosis.trust_score,
        description: diagnosis.trust_desc || "",
        dimensions: {
          brand_alignment: diagnosis.brand_match_score,
          certainty_risk: diagnosis.certainty_risk_score,
        }
      }
    },
    issues: diagnosis.issues as unknown as DiagnosisIssue[]
  };

  const wordCount = getWordCount(doc.original_content || "");
  const lowestSignal = Object.entries(data.signals).reduce((prev, curr) => {
    return curr[1].score < prev[1].score ? curr : prev;
  });

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Topbar */}
      <header className="h-[48px] px-6 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-[13px] font-medium text-gray-900 truncate max-w-[160px] sm:max-w-[300px]">
            {doc.title}
          </h1>
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-gray-400">
            <span className="capitalize">{doc.content_type.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>{wordCount} words</span>
            <span>·</span>
            <span className="uppercase">{doc.language_variant}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/history">
            <Button variant="secondary" size="sm" className="hidden lg:flex">History</Button>
          </Link>
          <Button variant="primary" size="sm" onClick={handleStartCleanup}>
            Start clean-up
          </Button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Mobile Tabs */}
        <div className="lg:hidden shrink-0">
          <Tabs 
            tabs={[
              { id: "scores", label: "Scores" },
              { id: "issues", label: `Issues (${data.issues.length})` },
              { id: "original", label: "Original" }
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* COLUMN 1: ORIGINAL (Desktop only or active tab on mobile) */}
        <div className={[
          "flex-1 lg:w-[280px] lg:flex-none lg:border-r border-gray-100 flex flex-col overflow-hidden bg-white",
          activeTab === "original" ? "flex" : "hidden lg:flex"
        ].join(" ")}>
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Original</h2>
            <span className="hidden lg:inline text-[12px] text-gray-400 italic">hover to inspect</span>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar" ref={originalColumnRef}>
            <HighlightText 
              content={doc.original_content || ""} 
              issues={data.issues}
              onHighlightClick={scrollToIssue}
              hoveredIssueId={hoveredIssueId}
              onHoverIssue={setHoveredIssueId}
            />
          </div>
        </div>

        {/* COLUMN 2: SCORES (Desktop only or active tab on mobile) */}
        <div className={[
          "flex-1 lg:w-[320px] lg:flex-none lg:border-r border-gray-100 flex flex-col overflow-hidden bg-gray-50",
          activeTab === "scores" ? "flex" : "hidden lg:flex"
        ].join(" ")}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Analysis</h2>
            <div className="flex items-center gap-1">
              <span className="text-[15px] font-bold text-gray-900">{diagnosis.average_score_original}</span>
              <span className="text-[12px] text-gray-400">/10</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
            {/* Headline Finding Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
              <h3 className="text-[12px] font-bold text-gray-900 uppercase mb-2">Main Finding</h3>
              <p className="text-[13px] text-gray-700 leading-snug">
                {data.headline_finding}
              </p>
            </div>

            {/* Signal Blocks */}
            <div className="space-y-4">
              {Object.entries(data.signals).map(([name, signal]) => (
                <SignalBlock 
                  key={name}
                  name={name} 
                  signal={signal} 
                  defaultExpanded={name === lowestSignal[0]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* COLUMN 3: ISSUES (Desktop only or active tab on mobile) */}
        <div className={[
          "flex-1 flex flex-col overflow-hidden bg-white",
          activeTab === "issues" ? "flex" : "hidden lg:flex"
        ].join(" ")}>
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Issues</h2>
            <span className="text-[12px] text-gray-400 font-medium">{data.issues.length} flagged</span>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar" ref={issuesColumnRef}>
            <div className="space-y-8">
              {["trust", "substance", "style"].map(priority => {
                const priorityIssues = data.issues.filter(i => i.priority === priority);
                if (priorityIssues.length === 0) return null;

                return (
                  <div key={priority}>
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        priority === 'trust' ? 'bg-red-500' : priority === 'substance' ? 'bg-amber-500' : 'bg-pink-500'
                      }`} />
                      {priority} issues
                    </h3>
                    <div className="space-y-2">
                      {priorityIssues.map((issue, idx) => (
                        <IssueCard 
                          key={idx} 
                          issue={issue} 
                          onCardClick={scrollToHighlight}
                          isHovered={hoveredIssueId === `${issue.priority}-${issue.char_start}-${issue.char_end}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Cleaning Overlay */}
      {isCleaning && (
        <div className="fixed inset-0 bg-white/90 dark:bg-gray-950/90 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <Spinner size="lg" className="mb-4" />
          <p className="text-[15px] font-medium text-gray-900 dark:text-white">Preparing your clean-up...</p>
        </div>
      )}
    </div>
  );
}
