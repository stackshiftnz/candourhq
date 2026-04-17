"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Database, UserEdit } from "@/types/database";
import { 
  CleanupParagraph as ParagraphType,
  ChangeTag
} from "@/lib/anthropic/types";
import { CleanupParagraph } from "@/components/cleanup/CleanupParagraph";
import { IssueQueue } from "@/components/cleanup/IssueQueue";
import { ExplanationDrawer } from "@/components/cleanup/ExplanationDrawer";
import { HighlightText } from "@/components/analyse/HighlightText";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowRightIcon, HistoryIcon, UserIcon, CheckCircle2Icon } from "lucide-react";
import { submitForApproval } from "@/app/actions/team";
import { useToast } from "@/lib/hooks/useToast";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];
type CleanupRecord = Database["public"]["Tables"]["cleanups"]["Row"];

export default function CleanupPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [doc, setDoc] = useState<Document | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [cleanup, setCleanup] = useState<CleanupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [cleanupTimedOut, setCleanupTimedOut] = useState(false);
  const cleanupPollingStart = useRef(Date.now());
  const CLEANUP_POLLING_TIMEOUT_MS = 150_000;
  const [requireApproval, setRequireApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // UI State
  const [activeDrawerTag, setActiveDrawerTag] = useState<ChangeTag | null>(null);
  const [activeTab, setActiveTab] = useState<"cleaned" | "queue" | "original">("cleaned");

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const { data: docData } = await supabase.from("documents").select("*").eq("id", id).single();
      const { data: diagData } = await supabase.from("diagnoses").select("*").eq("document_id", id).single();
      const { data: cleanData } = await supabase.from("cleanups").select("*").eq("document_id", id).single();

      if (docData) setDoc(docData);
      if (diagData) setDiagnosis(diagData);

      if (cleanData) {
        setCleanup(cleanData);
        setLoading(false);
      } else if (docData?.status === "cleaning") {
        setPolling(true);
      } else {
        setLoading(false);
      }

      // Check workspace require_approval_before_export setting
      if (docData?.workspace_id) {
        const { data: wsData } = await supabase
          .from("workspaces")
          .select("require_approval_before_export")
          .eq("id", docData.workspace_id)
          .maybeSingle();
        if (wsData?.require_approval_before_export) {
          setRequireApproval(true);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load clean-up data.");
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling logic
  useEffect(() => {
    if (!polling) return;

    cleanupPollingStart.current = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - cleanupPollingStart.current > CLEANUP_POLLING_TIMEOUT_MS) {
        clearInterval(interval);
        setPolling(false);
        setLoading(false);
        setCleanupTimedOut(true);
        
        toast("Clean-up failed. Please try again from the diagnosis screen.", "error");
        
        // Revert status to diagnosed
        await supabase
          .from("documents")
          .update({ status: "diagnosed" })
          .eq("id", id);
        return;
      }

      const { data: cleanData } = await supabase
        .from("cleanups")
        .select("*")
        .eq("document_id", id)
        .single();

      if (cleanData) {
        setCleanup(cleanData);
        setPolling(false);
        setLoading(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [polling, id, supabase, CLEANUP_POLLING_TIMEOUT_MS, toast]);

  // Derived state: first unresolved pause index
  const firstUnresolvedPauseIndex = useMemo(() => {
    if (!cleanup) return -1;
    return cleanup.paragraphs.findIndex(p => p.type === "pause");
  }, [cleanup]);

  const isParagraphQueued = (index: number) => {
    if (firstUnresolvedPauseIndex === -1) return false;
    return index > firstUnresolvedPauseIndex;
  };

  // Resolved Issue Matching Logic
  const resolvedIssuesData = useMemo(() => {
    if (!cleanup || !diagnosis) return { ids: new Set<string>(), indices: new Set<number>() };
    
    const ids = new Set<string>();
    const indices = new Set<number>();
    
    // 1. Check all change tags in paragraphs
    cleanup.paragraphs.forEach(p => {
      if (p.type === "clean" && p.changes) {
        p.changes.forEach(tag => {
          // Find matching issue in diagnosis
          diagnosis.issues.forEach((issue, idx) => {
            if (issue.phrase === tag.original_phrase || 
                tag.original_phrase.includes(issue.phrase) || 
                issue.phrase.includes(tag.original_phrase)) {
              const issueId = `${issue.priority}-${issue.char_start}-${issue.char_end}`;
              ids.add(issueId);
              indices.add(idx);
            }
          });
        });
      }
    });

    // 2. Count manual resolutions (like pause cards or "Accept remaining" if we track it specifically)
    // For simplicity, we also count issues_resolved count if it exceeds the tag count
    // but the phrase matching is better for the UI highlights.

    return { ids, indices };
  }, [cleanup, diagnosis]);

  const resolvedIssueIds = resolvedIssuesData.ids;
  const resolvedIssueIndices = resolvedIssuesData.indices;

  const issueToParagraphMap = useMemo(() => {
    if (!cleanup || !diagnosis) return new Map<number, number>();
    const map = new Map<number, number>();
    
    diagnosis.issues.forEach((issue, issueIdx) => {
      cleanup.paragraphs.forEach((p, pIdx) => {
        // Match by phrase or if it's a pause card that will address this
        if (p.type === "clean" && p.changes?.some(c => 
          c.original_phrase === issue.phrase || 
          c.original_phrase.includes(issue.phrase) ||
          issue.phrase.includes(c.original_phrase)
        )) {
          map.set(issueIdx, pIdx);
        }
        // Also match pause cards by query
        if (p.type === "pause" && p.pause_card?.question.toLowerCase().includes(issue.phrase.toLowerCase())) {
          map.set(issueIdx, pIdx);
        }
      });
    });
    return map;
  }, [cleanup, diagnosis]);

  const scrollToParagraph = (pIdx: number) => {
    const el = document.getElementById(`paragraph-${pIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-teal-200", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-2", "ring-teal-200", "ring-offset-2"), 2000);
    }
  };

  // Event Handlers
  const handleEdit = async (index: number, newText: string) => {
    if (!cleanup) return;

    const updatedParagraphs = [...cleanup.paragraphs];
    updatedParagraphs[index] = { ...updatedParagraphs[index], cleaned: newText };
    
    // Track user edit
    const userEdit: UserEdit = {
      paragraph_index: index,
      edited_at: new Date().toISOString(),
      original_cleaned: cleanup.paragraphs[index].cleaned || "",
      user_version: newText
    };

    const newUserEdits = [...(cleanup.user_edits || []), userEdit];

    setCleanup({ ...cleanup, paragraphs: updatedParagraphs, user_edits: newUserEdits });

    // Debounced patch
    await supabase.from("cleanups").update({
      paragraphs: updatedParagraphs,
      user_edits: newUserEdits
    }).eq("document_id", id);
  };

  const handleResolvePause = async (index: number, answer: string | null, skipped: boolean) => {
    if (!cleanup || !diagnosis) return;

    const updatedParagraphs = [...cleanup.paragraphs];
    const prevParagraph = updatedParagraphs[index];
    
    // Transform pause to clean
    const factChange = (!skipped && answer) ? [{
      tag: "fact_added" as const,
      original_phrase: "",
      cleaned_phrase: answer,
      explanation: `User-supplied fact added: "${answer}"`
    }] : [];

    updatedParagraphs[index] = {
      ...prevParagraph,
      type: "clean",
      cleaned: skipped ? (prevParagraph.cleaned || "") : `${answer}\n\n${prevParagraph.cleaned || ""}`.trim(),
      pause_card: null,
      changes: [...(prevParagraph.changes || []), ...factChange]
    } as ParagraphType;

    // Calculate new total resolved count
    const newResolvedCount = (cleanup.issues_resolved || 0) + 1;

    setCleanup({ ...cleanup, paragraphs: updatedParagraphs, issues_resolved: newResolvedCount });

    // If all resolved, update document status
    const isActuallyComplete = newResolvedCount >= diagnosis.issues.length;

    await supabase.from("cleanups").update({
      paragraphs: updatedParagraphs,
      issues_resolved: newResolvedCount
    }).eq("document_id", id);

    if (isActuallyComplete) {
      await finalizeCleanup(updatedParagraphs);
    }
  };

  const handleAcceptRemaining = async () => {
    if (!cleanup || !diagnosis) return;

    const totalIssues = diagnosis.issues.length;
    
    setCleanup({
      ...cleanup,
      issues_resolved: totalIssues
    });

    await supabase.from("cleanups").update({
      issues_resolved: totalIssues
    }).eq("document_id", id);

    await finalizeCleanup(cleanup.paragraphs);
  };

  const finalizeCleanup = async (paragraphs: ParagraphType[]) => {
    if (!doc || !cleanup) return;

    const finalContent = paragraphs
      .filter(p => p.type === "clean")
      .map(p => p.cleaned)
      .join("\n\n");

    // Update cleanups table with final content
    await supabase.from("cleanups").update({
      final_content: finalContent
    }).eq("document_id", id);

    // Use functional updater to avoid stale closure overwriting issues_resolved
    setCleanup(prev => prev ? { ...prev, final_content: finalContent } : prev);

    // Update documents table status
    await supabase.from("documents").update({
      status: "cleaned"
    }).eq("id", id);

    setDoc({ ...doc, status: "cleaned" });
  };


  const handleSubmitForApproval = async () => {
    if (!doc) return;
    setIsSubmitting(true);
    const result = await submitForApproval(typeof id === "string" ? id : id[0]);
    setIsSubmitting(false);
    if (result.success) {
      setDoc({ ...doc, status: "submitted" });
      toast("Submitted for approval.", "success");
    } else {
      toast("Failed to submit. Please try again.", "error");
    }
  };

  const currentScore = useMemo(() => {
    if (!doc || !cleanup || !diagnosis) return 0;
    const original = diagnosis.average_score_original || 0;
    const resolved = cleanup.issues_resolved || 0;
    const total = diagnosis.issues.length || 1;
    // Formula: original + (resolved/total) * (10-original) * 0.7
    return Number((original + (resolved / total) * (10 - original) * 0.7).toFixed(1));
  }, [doc, cleanup, diagnosis]);

  const progressPercent = useMemo(() => {
    if (!cleanup || !diagnosis) return 0;
    return Math.round(((cleanup.issues_resolved || 0) / diagnosis.issues.length) * 100);
  }, [cleanup, diagnosis]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <p className="text-[15px] font-medium text-red-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (cleanupTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white gap-4 p-8 text-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-gray-300">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2"/>
          <path d="M20 12v10M20 28h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h2 className="text-sm font-medium text-gray-900">Clean-up failed</h2>
        <p className="text-xs text-gray-500 max-w-xs">
          Something went wrong preparing your clean-up. Your document has been saved.
        </p>
        <div className="flex gap-2">
          <Link
            href={`/analyse/${id}`}
            className="px-3 py-1.5 text-[13px] font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Back to diagnosis
          </Link>
          <Link
            href="/history"
            className="px-3 py-1.5 text-[13px] font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            View history
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !doc || !diagnosis) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <Spinner size="lg" className="text-gray-900 mb-4" />
        <p className="text-[15px] font-medium text-gray-900 animate-pulse">
          {polling ? "Applying transformations..." : "Loading clean-up screen..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Topbar */}
      <div className="h-[56px] border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-50 bg-white">
        <div className="flex items-center gap-4">
          <Link href="/history" className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors">
            <HistoryIcon size={20} />
          </Link>
          <div>
            <h1 className="text-[14px] font-bold text-gray-900 leading-tight">
              {doc.title ? (doc.title.length > 30 ? doc.title.substring(0, 30) + "..." : doc.title) : "Untitled Document"}
            </h1>
            <p className="text-[12px] text-gray-400 font-medium">
              {cleanup?.issues_resolved || 0} of {diagnosis.issues.length} issues resolved
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/analyse/${id}`)}>
            Diagnosis
          </Button>
          {requireApproval ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitForApproval}
              loading={isSubmitting}
              disabled={progressPercent < 100 || doc?.status === "submitted"}
            >
              {doc?.status === "submitted" ? "Submitted" : "Submit for approval"}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(`/export/${typeof id === "string" ? id : id[0]}`)}
              disabled={progressPercent < 100}
            >
              Export
            </Button>
          )}
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <UserIcon size={16} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-[3px] w-full bg-gray-50 shrink-0">
        <div 
          className="h-full bg-teal-500 transition-all duration-[600ms] ease-out" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 flex overflow-hidden relative pt-[48px] md:pt-0">
        
        {/* Mobile Tabs (Mobile only) */}
        <div className="md:hidden absolute top-0 left-0 right-0 h-[48px] border-b border-gray-100 bg-white flex z-20">
          {(["cleaned", "queue", "original"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-[12px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === tab ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-400"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Column 1: Original (Desktop) */}
        <div className={`hidden md:flex flex-col w-[260px] border-right border-gray-100 bg-white shrink-0 overflow-hidden`}>
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Original</h2>
            <span className="text-[12px] text-gray-300 font-medium">Hover to inspect</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar opacity-60">
            <HighlightText 
              content={doc.original_content} 
              issues={diagnosis.issues} 
              resolvedIssueIds={resolvedIssueIds}
              onHighlightClick={(issueId) => {
                const parts = issueId.split("-");
                if (parts.length >= 3) {
                  const issue = diagnosis.issues.find(i => 
                    i.priority === parts[0] && 
                    i.char_start === parseInt(parts[1]) && 
                    i.char_end === parseInt(parts[2])
                  );
                  if (issue) {
                    const idx = diagnosis.issues.indexOf(issue);
                    const pIdx = issueToParagraphMap.get(idx);
                    if (pIdx !== undefined) scrollToParagraph(pIdx);
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Column 2: Cleaned Version (Main) */}
        <div className={`flex-1 flex flex-col bg-white overflow-hidden z-10 ${activeTab === "cleaned" ? "flex" : "hidden md:flex"}`}>
          <div className="hidden md:flex px-8 py-4 border-b border-gray-50">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Cleaned Version</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-6 sm:py-10 md:py-16 custom-scrollbar scroll-smooth">
            <div className="max-w-[640px] mx-auto">
              {cleanup?.paragraphs.map((p, idx) => (
                <CleanupParagraph 
                  key={idx}
                  paragraph={p}
                  index={idx}
                  isQueued={isParagraphQueued(idx)}
                  onEdit={handleEdit}
                  onTagClick={(tag) => setActiveDrawerTag(tag)}
                  onResolvePause={handleResolvePause}
                  hasUserEdit={cleanup.user_edits?.some(e => e.paragraph_index === idx) || false}
                />
              ))}

              {progressPercent === 100 && (
                <div className="mt-12 p-8 border-2 border-dashed border-teal-100 rounded-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                  <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                    <CheckCircle2Icon size={24} className="text-teal-600" />
                  </div>
                  <h3 className="text-[18px] font-bold text-gray-900 mb-2">Clean-up complete!</h3>
                  <p className="text-[14px] text-gray-500 mb-6">You&apos;ve resolved all {diagnosis.issues.length} issues. Your document is ready to go.</p>
                  <Button variant="primary" size="lg" onClick={() => router.push(`/export/${id}`)}>
                    Go to Export <ArrowRightIcon size={16} className="ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Bar (Visible if issues pending) */}
          {progressPercent < 100 && (
            <div className="h-[72px] border-t border-gray-100 px-4 sm:px-8 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-30">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Estimated Score</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[20px] font-bold text-gray-900">{currentScore}</span>
                    <span className="text-[12px] font-bold text-teal-600">+{ (currentScore - (diagnosis.average_score_original || 0)).toFixed(1) }pts</span>
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="md" onClick={handleAcceptRemaining}>
                Accept remaining changes
              </Button>
            </div>
          )}
        </div>

        {/* Column 3: Queue (Desktop) */}
        <div className={`hidden lg:block w-[280px] shrink-0 ${activeTab === "queue" ? "block" : "hidden lg:block"}`}>
          <IssueQueue 
            issues={diagnosis.issues}
            resolvedIssueIndices={resolvedIssueIndices}
            activeIndex={-1}
            onItemClick={(idx) => {
              const pIdx = issueToParagraphMap.get(idx);
              if (pIdx !== undefined) {
                setActiveTab("cleaned");
                scrollToParagraph(pIdx);
              }
            }}
          />
        </div>

        {/* Column 4: Drawer (Desktop) */}
        <ExplanationDrawer 
          isOpen={!!activeDrawerTag}
          onClose={() => setActiveDrawerTag(null)}
          tag={activeDrawerTag}
        />

      </div>


      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-from-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-in {
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
