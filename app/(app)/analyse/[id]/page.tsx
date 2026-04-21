"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database";
import { DiagnosisResponse, DiagnosisIssue } from "@/lib/anthropic/types";
import { HighlightText } from "@/components/analyse/HighlightText";
import { SignalBlock } from "@/components/analyse/SignalBlock";
import { IssueCard } from "@/components/analyse/IssueCard";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { ScanningView } from "@/components/analyse/ScanningView";
import { CleanupAmbitionModal } from "@/components/analyse/CleanupAmbitionModal";
import { useToast } from "@/lib/hooks/useToast";
import { Tabs } from "@/components/ui/Tabs";
import { getWordCount } from "@/lib/utils/word-count";
import { trackEvent } from "@/lib/telemetry/client";
import { 
  Clock, 
  FileText, 
  Zap, 
  CircleAlert,
  CircleCheck,
  History as HistoryIcon,
  Sparkles,
  ArrowRight,
  X,
  Activity,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2
} from "lucide-react";


type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];

export default function DiagnosisPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : (Array.isArray(params.id) ? params.id[0] : "");
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
  const [progress, setProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [collapsedCols, setCollapsedCols] = useState({ original: false, scores: false, issues: false });
  const [showAmbitionModal, setShowAmbitionModal] = useState(false);
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

  // Simulated progress logic
  useEffect(() => {
    if (analysisState !== "loading" || !loading) return;
    
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) return prev;
        // Faster at start, slower as it nears completion
        const increment = prev < 30 ? 2 : prev < 70 ? 0.8 : 0.2;
        return Math.min(prev + (Math.random() * increment), 99);
      });
    }, 200);
    
    return () => clearInterval(timer);
  }, [analysisState, loading]);

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
    setShowAmbitionModal(true);
  };

  const handleConfirmCleanup = async (ambition: string) => {
    if (!doc) return;
    setIsCleaning(true);
    setShowAmbitionModal(false);

    // Clean page owns the /api/clean fetch lifecycle so users see paragraphs
    // stream in on the destination screen instead of waiting on a spinner here.
    // We flip status to "cleaning" here so a refresh mid-generation still lands
    // the user in the right place.
    try {
      await supabase
        .from("documents")
        .update({ status: "cleaning" })
        .eq("id", id);
      router.push(`/clean/${id}?ambition=${ambition}`);
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
      <div className="flex-1 flex flex-col bg-background">
        {/* Simplified Header for Loading State */}
        <header className="h-16 px-6 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
             <div className="flex flex-col gap-1">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/30">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scanning Context...</span>
             </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
          <ScanningView 
            brandProfileName={brandProfileName} 
            progress={progress} 
            isTakingLong={takingLong}
          />
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

  const currentWordCount = getWordCount(doc.original_content || "");
  const lowestSignal = Object.entries(data.signals).reduce((prev, curr) => {
    return curr[1].score < prev[1].score ? curr : prev;
  }, Object.entries(data.signals)[0]);

  const issueCount = data.issues.length;
  const estimatedMinutes = Math.max(1, Math.ceil((issueCount * 25) / 60));
  const effortLabel = issueCount === 0
    ? "Perfect Score"
    : `${issueCount} ${issueCount === 1 ? "Issue" : "Issues"} • ~${estimatedMinutes}m fix`;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden selection:bg-primary/20">
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Diagnosis complete. {effortLabel}.
      </div>

      {/* --- Page Header --- */}
      <header className="h-16 px-6 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/history" className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors group">
             <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div className="flex flex-col min-w-0">
             <h1 className="text-sm font-bold tracking-tight text-foreground truncate max-w-[200px] sm:max-w-md">
               {doc.title}
             </h1>
             <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{doc.content_type.replace(/_/g, " ")}</span>
                <span className="text-[10px] text-border">•</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{currentWordCount} Words</span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
              <HistoryIcon size={14} className="text-foreground/60" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">Analysed {new Date(doc.created_at).toLocaleDateString()}</span>
          </div>
          <Button 
            variant="brand" 
            size="md" 
            className="rounded-full px-6 font-bold tracking-tight shadow-md transition-all active:scale-[0.98]"
            onClick={handleStartCleanup}
          >
            {issueCount === 0 ? "Project Export" : "Begin Clean-up"}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </header>

      {/* --- Three-Column Split --- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Mobile Tabs (Clean Segment Design) */}
        <div className="lg:hidden shrink-0 border-b border-border bg-card/50">
          <Tabs 
            tabs={[
              { id: "scores", label: "Analysis" },
              { id: "issues", label: `Insights (${data.issues.length})` },
              { id: "original", label: "Context" }
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="px-4"
          />
        </div>

        {/* --- COLUMN 1: CONTEXT (Original Text) --- */}
        <div className={cn(
          "flex flex-col overflow-hidden bg-background transition-all duration-500 border-r border-border relative shrink-0 lg:shrink",
          activeTab === "original" ? "flex flex-[2]" : "hidden lg:flex",
          collapsedCols.original ? "lg:w-12 lg:flex-none" : "lg:flex-[1.2] lg:min-w-0"
        )}>
          {collapsedCols.original ? (
            <button 
              onClick={() => toggleCol("original")}
              className="flex-1 flex flex-col items-center justify-center gap-6 hover:bg-muted/50 transition-all group/ribbon py-10"
            >
              <div className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/40 group-hover/ribbon:text-foreground transition-colors">
                <FileText size={16} />
              </div>
              <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.25em] -rotate-90 whitespace-nowrap group-hover/ribbon:text-foreground transition-colors">Context</span>
            </button>
          ) : (
            <>
              <div className="h-10 px-4 border-b border-border bg-muted/10 flex items-center justify-between shrink-0 font-bold text-[10px] uppercase tracking-widest text-foreground/70">
                <span>Original Context</span>
                <button
                  onClick={() => toggleCol("original")}
                  className="hidden lg:flex ml-auto p-1.5 hover:bg-muted rounded-lg transition-colors text-foreground/40"
                  title="Collapse Context"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-8 lg:px-12 py-10 custom-scrollbar scroll-smooth" ref={originalColumnRef}>
                 <div className="prose prose-sm dark:prose-invert max-w-none">
                  <HighlightText
                    content={doc.original_content || ""}
                    issues={data.issues}
                    onHighlightClick={scrollToIssue}
                    hoveredIssueId={hoveredIssueId}
                    onHoverIssue={setHoveredIssueId}
                  />
                 </div>
              </div>
            </>
          )}
        </div>

        {/* --- COLUMN 2: SCORE REPORT (Intelligence Cockpit) --- */}
        <div className={cn(
          "flex flex-col overflow-hidden bg-muted/5 transition-all duration-500 border-r border-border relative",
          activeTab === "scores" ? "flex flex-1" : "hidden lg:flex",
          collapsedCols.scores ? "lg:w-12 lg:flex-none" : "lg:flex-1 lg:min-w-0"
        )}>
          {collapsedCols.scores ? (
            <button 
              onClick={() => toggleCol("scores")}
              className="flex-1 flex flex-col items-center justify-center gap-6 hover:bg-muted/50 transition-all group/ribbon py-10"
            >
              <div className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/40 group-hover/ribbon:text-foreground transition-colors">
                <Activity size={16} />
              </div>
              <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.25em] -rotate-90 whitespace-nowrap group-hover/ribbon:text-foreground transition-colors">Report</span>
            </button>
          ) : (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none opacity-50" />
                
                <div className="h-10 px-4 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between shrink-0 z-10">
                  <div className="flex items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/70">Intelligence Report</span>
                    <div className="flex items-center gap-3 ml-2">
                      <span className="text-foreground text-[18px] font-black tracking-tighter transition-all group-hover:scale-110">{diagnosis.average_score_original}</span>
                      <span className="text-[10px] font-black text-foreground/30 shrink-0">/ 10</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleCol("scores")}
                    className="hidden lg:flex p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground/40"
                    title="Collapse Report"
                  >
                    <Minimize2 size={14} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar space-y-8 relative z-10 pb-24">
                  <div className="relative group/finding">
                    <div className="absolute inset-0 bg-primary/5 blur-3xl opacity-0 group-hover/finding:opacity-100 transition-opacity duration-1000" />
                    <div className="relative bg-background/40 backdrop-blur-md rounded-[32px] border border-border/50 p-7 shadow-2xl shadow-black/5 space-y-5 transition-all duration-500 hover:border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                          <Sparkles size={14} className="text-primary animate-pulse" /> Executive Finding
                        </div>
                        <div className="px-2 py-1 rounded-full bg-primary/5 text-[9px] font-black uppercase tracking-wider text-primary border border-primary/10">
                          Audit Verified
                        </div>
                      </div>
                      <p className="text-[15px] font-semibold leading-relaxed text-foreground/90 italic tracking-tight">
                        &ldquo;{data.headline_finding}&rdquo;
                      </p>
                      <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40 italic">
                         Expert diagnosis complete — {data.issues.length} focal points identified.
                      </div>
                    </div>
                  </div>

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
                          isActive={activeCategory === name}
                          onViewIssues={() => {
                            if (activeCategory === name) {
                              setActiveCategory(null);
                            } else {
                              const firstIdx = data.issues.findIndex(i => i.priority === name);
                              if (firstIdx >= 0) {
                                const issue = data.issues[firstIdx];
                                const issueId = `${issue.priority}-${issue.char_start}-${issue.char_end}`;
                                setActiveTab("issues");
                                setActiveCategory(name);
                                setTimeout(() => scrollToIssue(issueId), 100);
                              } else {
                                setActiveCategory(name);
                              }
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* --- COLUMN 3: INSIGHTS (Issue List) --- */}
        <div className={cn(
          "flex flex-col overflow-hidden bg-background transition-all duration-500 relative shrink-0 lg:shrink",
          activeTab === "issues" ? "flex flex-1" : "hidden lg:flex",
          collapsedCols.issues ? "lg:w-12 lg:flex-none" : "lg:flex-1 lg:min-w-0"
        )}>
          {collapsedCols.issues ? (
            <button 
              onClick={() => toggleCol("issues")}
              className="flex-1 flex flex-col items-center justify-center gap-6 hover:bg-muted/50 transition-all group/ribbon py-10"
            >
              <div className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/40 group-hover/ribbon:text-foreground transition-colors">
                <CircleAlert size={16} />
              </div>
              <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.25em] -rotate-90 whitespace-nowrap group-hover/ribbon:text-foreground transition-colors">Insights</span>
            </button>
          ) : (
            <>
              <div className="h-10 px-4 border-b border-border bg-muted/10 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCol("issues")}
                      className="hidden lg:flex p-1.5 hover:bg-muted rounded-lg transition-colors text-foreground/40"
                      title="Collapse Insights"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70">Critical Insights</span>
                 </div>
                 <div className="px-2 py-0.5 rounded-full bg-primary text-white text-[9px] font-black uppercase tracking-wider">{data.issues.length} Flagged</div>
              </div>
              
              <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar scroll-smooth" ref={issuesColumnRef}>
                {issueCount === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6">
                    <div className="w-24 h-24 rounded-[40%] bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
                       <CircleCheck size={40} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold tracking-tight">Enterprise Ready</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                        Your content meets all quality and brand standards. You're ready for publication.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12 pb-20">
                    {["trust", "substance", "style"].map(priority => {
                      const priorityIssues = data.issues.filter(i => i.priority === priority);
                      if (priorityIssues.length === 0) return null;
                      return (
                        <div key={priority} className="space-y-4">
                          <div className="flex items-center gap-3">
                             <div className={cn(
                               "h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]",
                               priority === 'trust' ? 'bg-accent' : priority === 'substance' ? 'bg-secondary' : 'bg-green-500'
                             )} />
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">
                               {priority} Issues
                             </h4>
                          </div>
                          <div className={cn(
                            "space-y-3 transition-opacity duration-300",
                            activeCategory && activeCategory !== priority ? "opacity-30 grayscale-[0.5]" : "opacity-100"
                          )}>
                            {priorityIssues.map((issue, idx) => (
                              <IssueCard
                                key={`${issue.char_start}-${idx}`}
                                issue={issue}
                                onCardClick={scrollToHighlight}
                                isHovered={hoveredIssueId === `${issue.priority}-${issue.char_start}-${issue.char_end}`}
                                isActive={activeCategory === priority}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* --- Mobile Fixed CTA --- */}
      <div className="lg:hidden shrink-0 border-t border-border bg-card/80 backdrop-blur-lg px-6 py-4 flex items-center justify-between gap-4 z-30">
        <div className="flex flex-col">
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Quality Score</span>
           <span className="text-lg font-black text-foreground">{diagnosis.average_score_original}<span className="text-[10px] font-bold opacity-30 ml-1">/ 10</span></span>
        </div>
        <Button 
          variant="brand" 
          className="rounded-full px-8 font-bold shadow-xl shadow-primary/20"
          onClick={handleStartCleanup}
        >
          {issueCount === 0 ? "Project Export" : "Fix Issues"}
        </Button>
      </div>

      {/* --- Mobile Issue Detail Overlay --- */}
      {mobileSheetIssue && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setMobileSheetIssue(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-[40px] px-8 pt-4 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-400">
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-8" />
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full shadow-lg",
                    mobileSheetIssue.priority === "trust" ? "bg-accent shadow-accent/20" :
                    mobileSheetIssue.priority === "substance" ? "bg-secondary shadow-secondary/20" : "bg-green-500"
                  )} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/60">
                    {mobileSheetIssue.priority} report
                  </span>
                </div>
                <button onClick={() => setMobileSheetIssue(null)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border italic text-sm font-bold text-foreground">
                  &ldquo;{mobileSheetIssue.phrase}&rdquo;
                </div>
                <div className="space-y-1">
                   <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest">Correction Logic</h4>
                   <p className="text-[15px] font-medium leading-relaxed text-foreground/80">
                     {mobileSheetIssue.explanation}
                   </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="lg"
                className="w-full rounded-2xl font-bold mt-4 h-14"
                onClick={() => {
                  setActiveTab("issues");
                  setMobileSheetIssue(null);
                }}
              >
                View Priority Group
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- Global Loading/Fixing Overlay --- */}
      {isCleaning && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[200] flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="relative w-20 h-20 mb-8">
             <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
             <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center text-primary">
                <Zap size={24} fill="currentColor" />
              </div>
          </div>
          <p className="text-xl font-bold tracking-tight animate-pulse">Launching Expert Clean-up...</p>
        </div>
      )}

      <CleanupAmbitionModal 
        isOpen={showAmbitionModal} 
        onClose={() => setShowAmbitionModal(false)}
        onConfirm={handleConfirmCleanup}
        isLoading={isCleaning}
      />
    </div>
  );
}
