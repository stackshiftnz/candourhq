"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database";
import { DiagnosisResponse, DiagnosisIssue, IssuePriority } from "@/lib/anthropic/types";
import { HighlightText } from "@/components/analyse/HighlightText";
import { IssuesDashboard } from "@/components/analyse/IssuesDashboard";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { ScanningView } from "@/components/analyse/ScanningView";
import { CleanupAmbitionModal } from "@/components/analyse/CleanupAmbitionModal";
import { useToast } from "@/lib/hooks/useToast";
import { Tabs } from "@/components/ui/Tabs";
import { getWordCount } from "@/lib/utils/word-count";
import { trackEvent } from "@/lib/telemetry/client";
import {
  FileText,
  Zap,
  History as HistoryIcon,
  ChevronLeft,
} from "lucide-react";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];

function getIssueId(issue: DiagnosisIssue): string {
  return issue.issue_id ?? `${issue.priority}-${issue.char_start}-${issue.char_end}`;
}

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
  const [activeTab, setActiveTab] = useState("content");
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [takingLong, setTakingLong] = useState(false);
  const [analysisState, setAnalysisState] = useState<"loading" | "error" | "done">("loading");
  const [progress, setProgress] = useState(0);
  const [showAmbitionModal, setShowAmbitionModal] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [tipDismissed, setTipDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("analyse-tip-dismissed") === "true";
  });

  const pollingStartTime = useRef(Date.now());
  const autoTriggerFired = useRef(false);
  const POLLING_TIMEOUT_MS = 90_000;

  const originalColumnRef = useRef<HTMLDivElement>(null);

  const handleError = useCallback(async () => {
    setAnalysisState("error");
    toast("Analysis failed. Your content has been saved — try again from History.", "error");

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`analyse-trigger:${id}`);
    }
    autoTriggerFired.current = false;

    await supabase
      .from("documents")
      .update({ status: "pending" })
      .eq("id", id);
  }, [id, supabase, toast]);

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
        // Pre-select all issues
        const issues = (diag.issues as unknown as DiagnosisIssue[]) || [];
        setSelectedIssueIds(new Set(issues.map(getIssueId)));
        trackEvent("screen_view", id, { screen: "analyse", issue_count: issues.length });
      }
      setLoading(false);
    } else if (doc.status === "pending") {
      const lockKey = `analyse-trigger:${id}`;
      if (autoTriggerFired.current) return;
      if (typeof window !== "undefined" && sessionStorage.getItem(lockKey)) return;

      autoTriggerFired.current = true;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(lockKey, Date.now().toString());
      }

      try {
        const res = await fetch("/api/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: id }),
        });
        if (!res.ok && res.status !== 409) {
          handleError();
        }
      } catch (e) {
        console.error("Failed to trigger analysis", e);
        handleError();
      }
    }
  }, [id, supabase, handleError]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Polling
  useEffect(() => {
    if (!doc || (doc.status !== "analysing" && doc.status !== "pending")) return;

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

      if (polledDoc?.status === "pending" && doc.status === "analysing") {
        clearInterval(timer);
        handleError();
        return;
      }

      if (elapsed > 20_000) setTakingLong(true);
    }, 2000);

    return () => clearInterval(timer);
  }, [doc, id, supabase, fetchDocument, handleError, POLLING_TIMEOUT_MS]);

  // Simulated progress
  useEffect(() => {
    if (analysisState !== "loading" || !loading) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) return prev;
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
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`analyse-trigger:${id}`);
    }
    autoTriggerFired.current = false;
    fetchDocument();
  }, [id, fetchDocument]);

  const handleToggleIssue = useCallback((issueId: string) => {
    setSelectedIssueIds(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((priority: IssuePriority, allIds: string[]) => {
    setSelectedIssueIds(prev => {
      const allSelected = allIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  const handleDismissTip = useCallback(() => {
    setTipDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("analyse-tip-dismissed", "true");
    }
  }, []);

  const handleStartCleanup = () => {
    if (!doc) return;
    setShowAmbitionModal(true);
  };

  const handleConfirmCleanup = async (ambition: string) => {
    if (!doc) return;
    setIsCleaning(true);
    setShowAmbitionModal(false);

    try {
      await supabase
        .from("documents")
        .update({ status: "cleaning" })
        .eq("id", id);

      const ids = Array.from(selectedIssueIds).join(",");
      router.push(`/clean/${id}?ambition=${ambition}&selectedIssues=${encodeURIComponent(ids)}`);
    } catch (e) {
      console.error("Cleanup navigation failed", e);
      setIsCleaning(false);
    }
  };

  const scrollToIssue = (issueId: string) => {
    const card = document.getElementById(`card-${issueId}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    setHoveredIssueId(issueId);
  };

  const scrollToHighlight = (issueId: string) => {
    const highlight = document.getElementById(`highlight-${issueId}`);
    if (highlight) highlight.scrollIntoView({ behavior: "smooth", block: "center" });
    setHoveredIssueId(issueId);
    setActiveTab("content");
  };

  // Hover from the right panel → highlight and scroll the left panel
  // (without switching mobile tab, since the user is on the issues tab)
  const handleDashboardHoverIssue = useCallback((issueId: string | null) => {
    setHoveredIssueId(issueId);
    if (issueId) {
      const highlight = document.getElementById(`highlight-${issueId}`);
      if (highlight) highlight.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

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

  if (loading || doc?.status === "analysing" || doc?.status === "pending") {
    return (
      <div className="flex-1 flex flex-col bg-background">
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
  const issueCount = data.issues.length;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden selection:bg-primary/20">
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        Diagnosis complete. {issueCount} {issueCount === 1 ? "issue" : "issues"} found.
      </div>

      {/* Page Header */}
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
              Analysed {new Date(doc.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </header>

      {/* Two-Panel Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* Mobile Tabs */}
        <div className="lg:hidden shrink-0 border-b border-border bg-card/50">
          <Tabs
            tabs={[
              { id: "content", label: "Content" },
              { id: "issues", label: `Issues (${issueCount})` },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="px-4"
          />
        </div>

        {/* LEFT PANEL: Original text with highlights */}
        <div className={cn(
          "flex flex-col overflow-hidden bg-background border-r border-border relative shrink-0",
          activeTab === "content" ? "flex flex-1" : "hidden",
          "lg:flex lg:w-[58%] lg:shrink-0"
        )}>
          <div className="h-10 px-4 border-b border-border bg-muted/10 flex items-center shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-foreground/50" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Original Content</span>
            </div>
          </div>
          <div
            className="flex-1 overflow-y-auto px-8 lg:px-12 py-10 custom-scrollbar scroll-smooth"
            ref={originalColumnRef}
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <HighlightText
                content={doc.original_content || ""}
                issues={data.issues}
                selectedIssueIds={selectedIssueIds}
                onHighlightClick={scrollToIssue}
                hoveredIssueId={hoveredIssueId}
                onHoverIssue={setHoveredIssueId}
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Issues Dashboard */}
        <div className={cn(
          "flex flex-col overflow-hidden relative",
          activeTab === "issues" ? "flex flex-1" : "hidden",
          "lg:flex lg:flex-1 lg:min-w-0"
        )}>
          <IssuesDashboard
            data={data}
            diagnosis={diagnosis}
            selectedIssueIds={selectedIssueIds}
            onToggleIssue={handleToggleIssue}
            onToggleGroup={handleToggleGroup}
            hoveredIssueId={hoveredIssueId}
            onHoverIssue={handleDashboardHoverIssue}
            onCardClick={scrollToHighlight}
            onBeginCleanup={handleStartCleanup}
            tipDismissed={tipDismissed}
            onDismissTip={handleDismissTip}
            isCleaning={isCleaning}
          />
        </div>
      </div>

      {/* Global Loading Overlay */}
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
