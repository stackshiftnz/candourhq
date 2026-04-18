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
import { trackEvent } from "@/lib/telemetry/client";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];

export default function DiagnosisPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [doc, setDoc] = useState<Document | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [brandProfileName, setBrandProfileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scores");
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [takingLong, setTakingLong] = useState(false);
  const [analysisState, setAnalysisState] = useState<"loading" | "error" | "done">("loading");
  const [mobileSheetIssue, setMobileSheetIssue] = useState<DiagnosisIssue | null>(null);
  const [collapsedCols, setCollapsedCols] = useState({ original: false, scores: false, issues: false });
  const toggleCol = (col: "original" | "scores" | "issues") =>
    setCollapsedCols((prev) => ({ ...prev, [col]: !prev[col] }));

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

    // Resolve brand profile name (document may have an explicit profile or
    // inherit the user's default).
    const resolveProfile = async () => {
      let profileId = doc.brand_profile_id;
      if (!profileId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: p } = await supabase
            .from("profiles")
            .select("default_brand_profile_id")
            .eq("id", session.user.id)
            .single();
          profileId = p?.default_brand_profile_id || null;
        }
      }
      if (profileId) {
        const { data: bp } = await supabase
          .from("brand_profiles")
          .select("name")
          .eq("id", profileId)
          .single();
        if (bp?.name) setBrandProfileName(bp.name);
      }
    };
    resolveProfile();

    // If diagnosed, fetch the diagnosis
    if (doc.status === "diagnosed") {
      const { data: diag } = await supabase
        .from("diagnoses")
        .select("*")
        .eq("document_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (diag) {
        setDiagnosis(diag);
        trackEvent("screen_view", id, { screen: "analyse", issue_count: (diag.issues as unknown as DiagnosisIssue[] || []).length });
      }
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

    // Clean page owns the /api/clean fetch lifecycle so users see paragraphs
    // stream in on the destination screen instead of waiting on a spinner here.
    // We flip status to "cleaning" here so a refresh mid-generation still lands
    // the user in the right place.
    try {
      await supabase
        .from("documents")
        .update({ status: "cleaning" })
        .eq("id", id);
      router.push(`/clean/${id}`);
    } catch (e) {
      console.error("Cleanup navigation failed", e);
      setIsCleaning(false);
    }
  };

  const scrollToIssue = (issueId: string) => {
    const card = document.getElementById(`card-${issueId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHoveredIssueId(issueId);

    // Mobile: also surface a bottom sheet with the explanation since hover tooltips
    // are invisible on touch. isTouchDevice via matchMedia keeps this cheap.
    if (typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches && diagnosis) {
      const issue = (diagnosis.issues as unknown as DiagnosisIssue[]).find(i =>
        `${i.priority}-${i.char_start}-${i.char_end}` === issueId
      );
      if (issue) setMobileSheetIssue(issue);
    }
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

  const issueCount = data.issues.length;
  const estimatedMinutes = Math.max(1, Math.ceil((issueCount * 25) / 60));
  const effortLabel = issueCount === 0
    ? "No issues flagged"
    : `${issueCount} ${issueCount === 1 ? "issue" : "issues"} · Est. ${estimatedMinutes} min to clean`;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Screen reader announcement of analysis result */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {issueCount === 0
          ? "Diagnosis complete. No issues flagged."
          : `Diagnosis complete. ${issueCount} ${issueCount === 1 ? "issue" : "issues"} flagged. Estimated ${estimatedMinutes} minutes to clean.`}
      </div>
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
            {brandProfileName ? (
              <>
                <span>·</span>
                <span className="text-gray-500 font-medium">{brandProfileName}</span>
              </>
            ) : null}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/history">
            <Button variant="secondary" size="sm" className="hidden lg:flex">History</Button>
          </Link>
          <Button variant="primary" size="sm" onClick={handleStartCleanup}>
            {issueCount === 0 ? "Skip to export" : "Start clean-up"}
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

        {/* COLUMN 1: ORIGINAL */}
        <div className={[
          "lg:border-r border-gray-100 flex flex-col overflow-hidden bg-white transition-all duration-200",
          activeTab === "original" ? "flex flex-1" : "hidden lg:flex",
          collapsedCols.original ? "lg:w-[32px] lg:flex-none" : "lg:w-[280px] lg:flex-none"
        ].join(" ")}>
          <div className="px-3 py-4 border-b border-gray-50 flex items-center justify-between shrink-0">
            {!collapsedCols.original && (
              <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Original</h2>
            )}
            <button
              onClick={() => toggleCol("original")}
              className="hidden lg:flex ml-auto items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={collapsedCols.original ? "Expand Original" : "Collapse Original"}
            >
              {collapsedCols.original ? <PanelLeftOpenIcon size={14} /> : <PanelLeftCloseIcon size={14} />}
            </button>
          </div>
          {!collapsedCols.original && (
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar" ref={originalColumnRef}>
              <HighlightText
                content={doc.original_content || ""}
                issues={data.issues}
                onHighlightClick={scrollToIssue}
                hoveredIssueId={hoveredIssueId}
                onHoverIssue={setHoveredIssueId}
              />
            </div>
          )}
        </div>

        {/* COLUMN 2: SCORES */}
        <div className={[
          "lg:border-r border-gray-100 flex flex-col overflow-hidden bg-gray-50 transition-all duration-200",
          activeTab === "scores" ? "flex flex-1" : "hidden lg:flex",
          collapsedCols.scores ? "lg:w-[32px] lg:flex-none" : "lg:w-[320px] lg:flex-none"
        ].join(" ")}>
          <div className="px-3 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
            {!collapsedCols.scores && (
              <>
                <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Analysis</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-gray-900">{diagnosis.average_score_original}</span>
                  <span className="text-[12px] text-gray-400">/10</span>
                </div>
              </>
            )}
            <button
              onClick={() => toggleCol("scores")}
              className="hidden lg:flex ml-auto items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={collapsedCols.scores ? "Expand Analysis" : "Collapse Analysis"}
            >
              {collapsedCols.scores ? <PanelLeftOpenIcon size={14} /> : <PanelLeftCloseIcon size={14} />}
            </button>
          </div>
          {!collapsedCols.scores && (
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
              {Object.entries(data.signals).map(([name, signal]) => {
                const count = data.issues.filter(i => i.priority === name).length;
                return (
                  <SignalBlock
                    key={name}
                    name={name}
                    signal={signal}
                    defaultExpanded={name === lowestSignal[0]}
                    issueCount={count}
                    onViewIssues={() => {
                      const firstMatchIdx = data.issues.findIndex(i => i.priority === name);
                      if (firstMatchIdx < 0) return;
                      const issue = data.issues[firstMatchIdx];
                      const issueId = `${issue.priority}-${issue.char_start}-${issue.char_end}`;
                      setActiveTab("issues");
                      // Slight delay so mobile tab transition completes before scroll
                      setTimeout(() => scrollToIssue(issueId), 50);
                    }}
                  />
                );
              })}
            </div>
          </div>
          )}
        </div>

        {/* COLUMN 3: ISSUES */}
        <div className={[
          "flex flex-col overflow-hidden bg-white transition-all duration-200",
          activeTab === "issues" ? "flex flex-1" : "hidden lg:flex",
          collapsedCols.issues ? "lg:w-[32px] lg:flex-none" : "lg:flex-1"
        ].join(" ")}>
          <div className="px-3 py-4 border-b border-gray-50 flex items-center justify-between shrink-0">
            {!collapsedCols.issues && (
              <>
                <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Issues</h2>
                <span className="text-[12px] text-gray-400 font-medium">{data.issues.length} flagged</span>
              </>
            )}
            <button
              onClick={() => toggleCol("issues")}
              className="hidden lg:flex ml-auto items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={collapsedCols.issues ? "Expand Issues" : "Collapse Issues"}
            >
              {collapsedCols.issues ? <PanelRightOpenIcon size={14} /> : <PanelRightCloseIcon size={14} />}
            </button>
          </div>
          {!collapsedCols.issues && (
          <>
          <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar" ref={issuesColumnRef}>
            {issueCount === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 text-emerald-600">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h3 className="text-[15px] font-semibold text-gray-900 mb-1">This content is already brand-aligned</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed max-w-[280px]">
                  No substance, style, or trust issues flagged. You can skip clean-up and go straight to export.
                </p>
              </div>
            ) : (
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
            )}
          </div>
          <div className="hidden lg:flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-white shrink-0">
            <span className="text-[12px] font-medium text-gray-500">{effortLabel}</span>
            <Button variant="primary" size="sm" onClick={handleStartCleanup}>
              {issueCount === 0 ? "Skip to export" : "Start clean-up"}
            </Button>
          </div>
          </>
          )}
        </div>

      </div>

      {/* Mobile persistent bottom CTA */}
      <div className="lg:hidden shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-gray-500 truncate">{effortLabel}</span>
        <Button variant="primary" size="sm" onClick={handleStartCleanup}>
          {issueCount === 0 ? "Skip to export" : "Start clean-up"}
        </Button>
      </div>

      {/* Mobile bottom sheet for highlight taps */}
      {mobileSheetIssue && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
            onClick={() => setMobileSheetIssue(null)}
          />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl p-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  mobileSheetIssue.priority === "trust" ? "bg-red-500" :
                  mobileSheetIssue.priority === "substance" ? "bg-amber-500" : "bg-pink-500"
                }`} />
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  {mobileSheetIssue.priority} · {mobileSheetIssue.category.replace(/_/g, " ")}
                </span>
              </div>
              <button
                onClick={() => setMobileSheetIssue(null)}
                className="text-gray-400 hover:text-gray-900 text-[18px] leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-[14px] font-semibold text-gray-900 mb-2">
              &ldquo;{mobileSheetIssue.phrase}&rdquo;
            </p>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
              {mobileSheetIssue.explanation}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveTab("issues");
                setMobileSheetIssue(null);
              }}
            >
              See all issues
            </Button>
          </div>
        </>
      )}

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
