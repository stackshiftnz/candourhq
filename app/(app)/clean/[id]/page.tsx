"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database, UserEdit } from "@/types/database";
import {
  CleanupParagraph as ParagraphType,
  ChangeTag,
  DiagnosisIssue
} from "@/lib/anthropic/types";
import { CleanupParagraph } from "@/components/cleanup/CleanupParagraph";
import { IssueQueue } from "@/components/cleanup/IssueQueue";
import { TransformationView } from "@/components/cleanup/TransformationView";
import { ExplanationDrawer } from "@/components/cleanup/ExplanationDrawer";
import { HighlightText } from "@/components/analyse/HighlightText";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowRight, History, User, CheckCircle, Info, Clock, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { submitForApproval } from "@/app/actions/team";
import { useToast } from "@/lib/hooks/useToast";
import { trackEvent } from "@/lib/telemetry/client";
import { writeRevision } from "@/lib/cleanup/revisions";
import { RevisionHistoryDrawer } from "@/components/cleanup/RevisionHistoryDrawer";
import { DiffView } from "@/components/cleanup/DiffView";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];
type CleanupRecord = Database["public"]["Tables"]["cleanups"]["Row"];

export default function CleanupPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : (Array.isArray(params.id) ? params.id[0] : "");
  const searchParams = useSearchParams();
  const ambition = searchParams.get("ambition") || "conservative";
  const router = useRouter();
  const supabase = createClient();

  const [doc, setDoc] = useState<Document | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [cleanup, setCleanup] = useState<CleanupRecord | null>(null);
  const [brandProfileName, setBrandProfileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [cleanupTimedOut, setCleanupTimedOut] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<"changes" | "diff">("changes");
  const [collapsedCols, setCollapsedCols] = useState({ original: false, queue: false });
  const toggleCol = (col: "original" | "queue") =>
    setCollapsedCols((prev) => ({ ...prev, [col]: !prev[col] }));
  const [streamingParagraphs, setStreamingParagraphs] = useState<ParagraphType[]>([]);
  const [streamRunning, setStreamRunning] = useState(false);
  const streamStartedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [pollingElapsed, setPollingElapsed] = useState(0);
  const cleanupPollingStart = useRef(Date.now());

  // Scale timeout by word count: ~45s baseline + ~80ms per word, capped at 5 min.
  // A 300-word doc gets ~69s; a 2000-word doc gets the full 5-minute ceiling.
  const cleanupTimeoutMs = useMemo(() => {
    const words = doc?.word_count || 300;
    return Math.min(45_000 + words * 80, 300_000);
  }, [doc?.word_count]);
  const [requireApproval, setRequireApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const expectedParagraphCount = useMemo(() => {
    if (!doc?.original_content) return 0;
    return doc.original_content.trim().split(/\n\s*\n/).filter(p => p.trim()).length;
  }, [doc?.original_content]);

  const streamProgress = useMemo(() => {
    if (!polling) return 0;
    if (expectedParagraphCount === 0) return 0;
    // Current paragraphs / (total + 1 for buffer) * 100
    // We use total + 1 to keep it from hitting 100% too early
    const realProgress = (streamingParagraphs.length / (expectedParagraphCount + 1)) * 100;
    // But we also want it to move even if no paragraphs arrived yet (elapsed time)
    const elapsedProgress = Math.min(15, (pollingElapsed / 1000) * 2); // max 15% from time
    return Math.max(realProgress, elapsedProgress);
  }, [streamingParagraphs.length, expectedParagraphCount, polling, pollingElapsed]);

  const { toast } = useToast();

  // UI State
  const [activeDrawerTag, setActiveDrawerTag] = useState<ChangeTag | null>(null);
  const [activeTab, setActiveTab] = useState<"cleaned" | "queue" | "original">("cleaned");

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const { data: docData } = await supabase.from("documents").select("*").eq("id", id).single();
      const { data: diagData } = await supabase.from("diagnoses").select("*").eq("document_id", id).single();
      const { data: cleanData } = await supabase.from("cleanups").select("*").eq("document_id", id).maybeSingle();

      if (docData) setDoc(docData);
      if (diagData) setDiagnosis(diagData);

      if (cleanData) {
        setCleanup(cleanData);
        setLoading(false);
        trackEvent("screen_view", id, {
          screen: "clean",
          issues_total: cleanData.issues_total ?? 0,
          issues_resolved: cleanData.issues_resolved ?? 0,
        });
      } else if (docData?.status === "cleaning") {
        setPolling(true);
      } else {
        setLoading(false);
      }

      // Resolve brand profile name for topbar display
        if (docData) {
          let profileId = docData.brand_profile_id;
          if (!profileId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: p } = await supabase
                .from("profiles")
                .select("default_brand_profile_id")
                .eq("id", user.id)
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

  // Elapsed counter keeps the waiting UI live even though the stream, not a
  // poller, is what actually produces paragraphs. Using a separate effect so
  // the stream kickoff stays single-shot and not bound to re-renders.
  useEffect(() => {
    if (!polling) return;
    cleanupPollingStart.current = Date.now();
    setPollingElapsed(0);
    const interval = setInterval(() => {
      const elapsed = Date.now() - cleanupPollingStart.current;
      setPollingElapsed(elapsed);
      if (elapsed > cleanupTimeoutMs) {
        clearInterval(interval);
        abortControllerRef.current?.abort();
        setPolling(false);
        setLoading(false);
        setStreamRunning(false);
        setCleanupTimedOut(true);
        toast("Clean-up timed out. Please try again from the diagnosis screen.", "error");
        void supabase.from("documents").update({ status: "diagnosed" }).eq("id", id);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [polling, cleanupTimeoutMs, id, supabase, toast]);

  // Streaming clean-up: POSTs to /api/clean and reads Server-Sent Events.
  // Each "paragraph" event appends to streamingParagraphs so the Cleaned
  // column fills in live. On "complete" we fetch the final row and hand off
  // to the regular edit flow. On "error" we surface a retry affordance.
  useEffect(() => {
    if (!polling) return;
    if (streamStartedRef.current) return;
    streamStartedRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let cancelled = false;

    (async () => {
      setStreamRunning(true);
      setStreamingParagraphs([]);
      try {
        const res = await fetch("/api/clean", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: id, ambition }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Clean stream failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processBuffer = async () => {
          let frameEnd: number;
          while ((frameEnd = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, frameEnd);
            buffer = buffer.slice(frameEnd + 2);

            let eventName = "message";
            let dataLine = "";
            for (const line of frame.split("\n")) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;

            try {
              const payload = JSON.parse(dataLine);
              if (eventName === "paragraph" && payload.paragraph) {
                const incoming = payload.paragraph as ParagraphType;
                setStreamingParagraphs((prev) => {
                  const next = prev.slice();
                  next[payload.index] = incoming;
                  return next;
                });
              } else if (eventName === "complete") {
                const { data: cleanData } = await supabase
                  .from("cleanups")
                  .select("*")
                  .eq("document_id", id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .single();
                if (cleanData) setCleanup(cleanData);
                setPolling(false);
                setLoading(false);
                setStreamRunning(false);
                return true; // signal completion
              } else if (eventName === "error") {
                throw new Error(payload.error || "Clean-up failed.");
              }
            } catch (parseErr) {
              // Re-throw real errors; skip JSON parse failures on non-data frames
              if (parseErr instanceof Error && parseErr.message !== "Clean-up failed." && !parseErr.message.startsWith("JSON")) {
                throw parseErr;
              }
              console.error("[clean-stream] parse error", parseErr, dataLine);
            }
          }
          return false;
        };

        while (!cancelled) {
          const { value, done } = await reader.read();
          // Always decode — include final flush when done
          if (value) buffer += decoder.decode(value, { stream: !done });

          // Parse complete SSE frames (separated by blank lines).
          const completed = await processBuffer();
          if (completed) return;

          if (done) break;
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[clean-stream] error", err);
        setPolling(false);
        setLoading(false);
        setStreamRunning(false);
        setCleanupTimedOut(true);
        toast("Clean-up failed. Please try again from the diagnosis screen.", "error");
        await supabase.from("documents").update({ status: "diagnosed" }).eq("id", id);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      abortControllerRef.current = null;
    };
  }, [polling, id, supabase, toast]);

  // Seed an ai_initial revision the first time we have a cleanup record with no
  // prior history — that snapshot is the unedited AI output reviewers can return to.
  const aiInitialSeededRef = useRef(false);
  useEffect(() => {
    if (!cleanup || aiInitialSeededRef.current) return;
    aiInitialSeededRef.current = true;
    (async () => {
      const { count } = await supabase
        .from("cleanup_revisions")
        .select("id", { head: true, count: "exact" })
        .eq("cleanup_id", cleanup.id);
      if ((count ?? 0) === 0) {
        await writeRevision({
          cleanupId: cleanup.id,
          documentId: String(id),
          eventType: "ai_initial",
          paragraphs: cleanup.paragraphs,
          userEdits: cleanup.user_edits || [],
        });
      }
    })();
  }, [cleanup, id, supabase]);

  // Derived state: first unresolved pause index
  const firstUnresolvedPauseIndex = useMemo(() => {
    if (!cleanup) return -1;
    return cleanup.paragraphs.findIndex(p => p.type === "pause");
  }, [cleanup]);

  const isParagraphQueued = (index: number) => {
    if (firstUnresolvedPauseIndex === -1) return false;
    return index > firstUnresolvedPauseIndex;
  };

  // Resolved Issue Matching Logic — prefers deterministic issue_id, falls back
  // to fuzzy string matching for diagnoses persisted before issue_id existed.
  const resolvedIssuesData = useMemo(() => {
    if (!cleanup || !diagnosis) return { ids: new Set<string>(), indices: new Set<number>() };

    const ids = new Set<string>();
    const indices = new Set<number>();

    const canonicalId = (issue: DiagnosisIssue) =>
      issue.issue_id || `${issue.priority}-${issue.char_start}-${issue.char_end}`;

    const issuesByIndex: Array<{ issue: DiagnosisIssue; idx: number; id: string }> = diagnosis.issues
      .map((issue, idx) => ({ issue, idx, id: canonicalId(issue) }));

    const markResolved = (id: string) => {
      const entry = issuesByIndex.find(e => e.id === id);
      if (entry) {
        ids.add(entry.id);
        indices.add(entry.idx);
      }
    };

    cleanup.paragraphs.forEach(p => {
      // Resolved changes on clean paragraphs
      if (p.type === "clean" && p.changes) {
        p.changes.forEach(tag => {
          if (tag.issue_id) {
            markResolved(tag.issue_id);
          } else {
            // Backwards-compat fuzzy match
            issuesByIndex.forEach(({ issue, idx, id }) => {
              if (
                issue.phrase === tag.original_phrase ||
                tag.original_phrase.includes(issue.phrase) ||
                issue.phrase.includes(tag.original_phrase)
              ) {
                ids.add(id);
                indices.add(idx);
              }
            });
          }
        });
      }
      // Resolved pause cards (converted to clean paragraphs retain their pause_card.issue_id
      // via the synthetic fact_added change tag — see handleResolvePause).
    });

    return { ids, indices };
  }, [cleanup, diagnosis]);

  const resolvedIssueIds = resolvedIssuesData.ids;
  const resolvedIssueIndices = resolvedIssuesData.indices;

  const issueToParagraphMap = useMemo(() => {
    if (!cleanup || !diagnosis) return new Map<number, number>();
    const map = new Map<number, number>();

    const canonicalId = (issue: DiagnosisIssue) =>
      issue.issue_id || `${issue.priority}-${issue.char_start}-${issue.char_end}`;

    (diagnosis.issues as unknown as DiagnosisIssue[]).forEach((issue, issueIdx) => {
      const id = canonicalId(issue);
      cleanup.paragraphs.forEach((p, pIdx) => {
        if (p.type === "clean" && p.changes?.some(c => {
          if (c.issue_id && c.issue_id === id) return true;
          if (c.issue_id) return false; // issue_id present but doesn't match → no fuzzy fallback
          // Backwards-compat fuzzy match when no issue_id is set
          return (
            c.original_phrase === issue.phrase ||
            c.original_phrase.includes(issue.phrase) ||
            issue.phrase.includes(c.original_phrase)
          );
        })) {
          map.set(issueIdx, pIdx);
        }
        if (p.type === "pause" && p.pause_card) {
          if (p.pause_card.issue_id && p.pause_card.issue_id === id) {
            map.set(issueIdx, pIdx);
          } else if (!p.pause_card.issue_id && p.pause_card.question.toLowerCase().includes(issue.phrase.toLowerCase())) {
            map.set(issueIdx, pIdx);
          }
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

    void writeRevision({
      cleanupId: cleanup.id,
      documentId: String(id),
      eventType: "user_edit",
      paragraphs: updatedParagraphs,
      userEdits: newUserEdits,
      metadata: { paragraph_index: index },
    });

    trackEvent("change_accepted", id, { paragraph_index: index, kind: "user_edit" });
  };

  const handleRevert = async (index: number) => {
    if (!cleanup) return;
    // Find the earliest user_edit for this paragraph — its original_cleaned is the
    // AI-produced version before the user ever touched it.
    const edits = cleanup.user_edits || [];
    const paragraphEdits = edits.filter(e => e.paragraph_index === index);
    if (paragraphEdits.length === 0) return;
    const firstEdit = paragraphEdits.reduce((earliest, e) =>
      new Date(e.edited_at) < new Date(earliest.edited_at) ? e : earliest
    );
    const aiVersion = firstEdit.original_cleaned;

    const updatedParagraphs = [...cleanup.paragraphs];
    updatedParagraphs[index] = { ...updatedParagraphs[index], cleaned: aiVersion };

    // Clear edits for this paragraph (revert drops them from the audit trail —
    // simpler than nesting reverts; users can re-edit if they want)
    const newUserEdits = edits.filter(e => e.paragraph_index !== index);

    setCleanup({ ...cleanup, paragraphs: updatedParagraphs, user_edits: newUserEdits });

    await supabase.from("cleanups").update({
      paragraphs: updatedParagraphs,
      user_edits: newUserEdits
    }).eq("document_id", id);

    void writeRevision({
      cleanupId: cleanup.id,
      documentId: String(id),
      eventType: "revert",
      paragraphs: updatedParagraphs,
      userEdits: newUserEdits,
      metadata: { paragraph_index: index },
    });

    trackEvent("change_reverted", id, { paragraph_index: index });
  };

  const handleRestoreRevision = async (paragraphs: ParagraphType[], userEdits: UserEdit[]) => {
    if (!cleanup) return;
    setCleanup({ ...cleanup, paragraphs, user_edits: userEdits });

    await supabase.from("cleanups").update({
      paragraphs,
      user_edits: userEdits,
    }).eq("document_id", id);

    // Record the restore itself as a revision so the audit trail shows it.
    void writeRevision({
      cleanupId: cleanup.id,
      documentId: String(id),
      eventType: "revert",
      paragraphs,
      userEdits,
      metadata: { source: "history_drawer" },
    });

    toast("Restored earlier version.", "success");
  };

  const handleResolvePause = async (index: number, answer: string | null, skipped: boolean) => {
    if (!cleanup || !diagnosis) return;

    const updatedParagraphs = [...cleanup.paragraphs];
    const prevParagraph = updatedParagraphs[index];

    // Preserve the pause card's issue_id on the synthetic change tag so the
    // resolved-issues matching logic correctly strikes through the highlight
    // in the Original column and ticks the queue item.
    const pauseIssueId = prevParagraph.pause_card?.issue_id;

    // Transform pause to clean. Per spec:
    // - Answer provided  → fact_added change tag
    // - Skipped or empty → softened change tag (claim reduced without evidence)
    // Use the paragraph's original text as the original_phrase so the change is
    // traceable even for pre-issue_id data.
    const hasAnswer = !skipped && !!answer;
    const factChange: ChangeTag[] = hasAnswer
      ? [{
          tag: "fact_added" as const,
          original_phrase: prevParagraph.original || "",
          cleaned_phrase: answer!,
          explanation: `User-supplied fact added: "${answer}"`,
          ...(pauseIssueId ? { issue_id: pauseIssueId } : {})
        }]
      : [{
          tag: "softened" as const,
          original_phrase: prevParagraph.original || "",
          cleaned_phrase: prevParagraph.cleaned ?? prevParagraph.original ?? "",
          explanation: "Claim softened — no supporting evidence provided.",
          ...(pauseIssueId ? { issue_id: pauseIssueId } : {})
        }];

    // Pause paragraphs have cleaned=null by design. Fall back to original text so
    // we never emit an empty paragraph. If the user provided an answer, append it
    // below the original claim so they can weave it inline via contentEditable;
    // the synthetic change tag above records this as a fact_added edit.
    const baseContent = prevParagraph.cleaned ?? prevParagraph.original ?? "";
    const resolvedContent = hasAnswer
      ? `${baseContent}\n\n${answer}`.trim()
      : baseContent;

    updatedParagraphs[index] = {
      ...prevParagraph,
      type: "clean",
      cleaned: resolvedContent,
      pause_card: null,
      changes: [...(prevParagraph.changes || []), ...factChange]
    } as ParagraphType;

    // Calculate new counters
    const newResolvedCount = (cleanup.issues_resolved || 0) + 1;
    const wasAnswered = !skipped && !!answer;
    const newAnsweredCount = (cleanup.pause_cards_answered || 0) + (wasAnswered ? 1 : 0);

    setCleanup({
      ...cleanup,
      paragraphs: updatedParagraphs,
      issues_resolved: newResolvedCount,
      pause_cards_answered: newAnsweredCount
    });

    // If all resolved, update document status
    const isActuallyComplete = newResolvedCount >= diagnosis.issues.length;

    await supabase.from("cleanups").update({
      paragraphs: updatedParagraphs,
      issues_resolved: newResolvedCount,
      pause_cards_answered: newAnsweredCount
    }).eq("document_id", id);

    void writeRevision({
      cleanupId: cleanup.id,
      documentId: String(id),
      eventType: hasAnswer ? "pause_resolved" : "pause_skipped",
      paragraphs: updatedParagraphs,
      userEdits: cleanup.user_edits || [],
      metadata: { paragraph_index: index, answer: hasAnswer ? answer : null },
    });

    trackEvent(hasAnswer ? "pause_card_answered" : "pause_card_skipped", id, {
      paragraph_index: index,
    });

    if (isActuallyComplete) {
      trackEvent("cleanup_completed", id, { issues_total: diagnosis.issues.length });
      await finalizeCleanup(updatedParagraphs);
    }
  };

  const handleAcceptRemaining = async () => {
    if (!cleanup || !diagnosis) return;

    const totalIssues = diagnosis.issues.length;
    
    // 1. Convert all remaining pause cards to clean paragraphs (softened/skipped)
    const updatedParagraphs: ParagraphType[] = cleanup.paragraphs.map(p => {
      if (p.type === "clean") return p;
      return {
        ...p,
        type: "clean",
        cleaned: p.cleaned || p.original || "",
        pause_card: null,
        changes: [
          ...(p.changes || []),
          {
            tag: "softened" as const,
            original_phrase: p.original || "",
            cleaned_phrase: p.cleaned || p.original || "",
            explanation: "Claim softened — evidence prompts skipped.",
            ...(p.pause_card?.issue_id ? { issue_id: p.pause_card.issue_id } : {})
          }
        ]
      } as ParagraphType;
    });

    setCleanup({
      ...cleanup,
      paragraphs: updatedParagraphs,
      issues_resolved: totalIssues
    });

    await supabase.from("cleanups").update({
      paragraphs: updatedParagraphs,
      issues_resolved: totalIssues
    }).eq("document_id", id);

    void writeRevision({
      cleanupId: cleanup.id,
      documentId: String(id),
      eventType: "accept_remaining",
      paragraphs: updatedParagraphs,
      userEdits: cleanup.user_edits || [],
      metadata: { issues_total: totalIssues },
    });

    await finalizeCleanup(updatedParagraphs);
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
    setIsSubmitting(true);
    if (!doc || !id) {
      setIsSubmitting(false);
      return;
    }
    const result = await submitForApproval(id);
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

  const paragraphMismatch = useMemo(() => {
    if (!doc?.original_content || !cleanup?.paragraphs) return null;
    const originalCount = doc.original_content.trim().split(/\n\s*\n/).filter(p => p.trim()).length;
    const cleanedCount = cleanup.paragraphs.length;
    if (originalCount === cleanedCount) return null;
    return { originalCount, cleanedCount };
  }, [doc, cleanup]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const { 
    Clock, 
    FileText, 
    Zap, 
    PanelLeftClose, 
    PanelLeftOpen, 
    PanelRightClose, 
    PanelRightOpen,
    AlertCircle,
    CheckCircle2,
    History: HistoryIcon,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    X,
    Layout,
    Split,
    RotateCcw,
    Send,
    Eye,
    Settings
  } = require("lucide-react");

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center bg-background">
        <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center text-accent">
          <AlertCircle size={40} strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Critical Error</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{error}</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="primary" className="px-10 rounded-full">
           Re-initialise Workspace
        </Button>
      </div>
    );
  }

  if (cleanupTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center bg-background">
        <div className="w-20 h-20 rounded-3xl bg-secondary/10 flex items-center justify-center text-secondary">
          <Clock size={40} strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Worker Timeout</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            The processing took longer than the allocated budget. Your document state has been preserved.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/analyse/${id}`}>
            <Button variant="primary" className="px-8 rounded-full shadow-lg shadow-primary/20">
              Return to Analysis
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="secondary" className="px-8 rounded-full">
               System History
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !doc || !diagnosis) {
    const elapsedSeconds = Math.round(pollingElapsed / 1000);
    
    // Switch to TransformationView if no paragraphs are visible yet OR if it's still initializing
    if (polling && streamingParagraphs.filter(Boolean).length === 0) {
      return (
        <div className="flex-1 flex flex-col bg-background">
          <header className="h-16 px-8 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between shrink-0 z-50">
            <div className="flex items-center gap-4">
               <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
               <div className="flex flex-col gap-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-2 w-20 bg-muted/60 rounded animate-pulse" />
               </div>
            </div>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <TransformationView 
              brandProfileName={brandProfileName} 
              progress={streamProgress} 
              isTakingLong={pollingElapsed > 25000}
            />
          </div>
        </div>
      );
    }

    // Live preview while the stream delivers paragraphs
    if (streamRunning && streamingParagraphs.length > 0) {
      return (
        <div className="flex flex-col h-full bg-background overflow-hidden selection:bg-primary/20">
          <div className="h-16 border-b border-border flex items-center justify-between px-8 bg-background/50 backdrop-blur-md shrink-0 z-50">
            <div className="flex items-center gap-4">
               <div className="relative w-8 h-8">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
               </div>
                <div className="flex flex-col min-w-0">
                  <h1 className="text-sm font-bold text-foreground truncate max-w-md">{doc?.title || "Refining Document"}</h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">
                     Refining Intelligence · {streamingParagraphs.filter(Boolean).length} / {expectedParagraphCount} Blocks Processed
                  </p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  Elapsed: {elapsedSeconds}s
               </div>
               <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
          
          <div className="h-1 w-full bg-muted shrink-0 overflow-hidden">
            <div className="h-full bg-primary transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.5)]" style={{ width: `${streamProgress}%` }} />
          </div>

          <div className="flex-1 overflow-y-auto px-4 lg:px-0 py-12 lg:py-20 bg-background relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--color-primary-rgb),0.03),transparent)] pointer-events-none" />
            <article className="max-w-3xl mx-auto space-y-10">
              {streamingParagraphs.map((p, i) => {
                if (!p) return (
                  <div key={i} className="space-y-3 opacity-20">
                    <div className="h-4 w-full bg-muted rounded-full" />
                    <div className="h-4 w-[90%] bg-muted rounded-full" />
                    <div className="h-4 w-[60%] bg-muted rounded-full" />
                  </div>
                );
                return (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {p.type === "pause" && (
                      <div className="mb-4 flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[10px] font-bold text-secondary tracking-widest uppercase w-fit">
                        <Zap size={10} fill="currentColor" /> Structural Gap Identified
                      </div>
                    )}
                    <p className={cn(
                      "text-lg lg:text-xl font-medium leading-relaxed tracking-tight",
                      p.type === 'pause' ? "text-muted-foreground/60" : "text-foreground opacity-90"
                    )}>
                      {p.type === "clean" ? (p.cleaned || p.original) : p.original}
                    </p>
                  </div>
                );
              })}
              <div className="flex items-center justify-center py-12 opacity-40">
                 <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1s_infinite_0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1s_infinite_200ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1s_infinite_400ms]" />
                 </div>
              </div>
            </article>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-background">
        <div className="relative w-24 h-24 mb-10">
          <div className="absolute inset-0 rounded-[40%] border-[6px] border-primary/20 animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-0 rounded-[40%] border-[6px] border-primary border-t-transparent animate-[spin_2s_linear_infinite]" />
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Layers size={32} className="animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
           <h2 className="text-2xl font-bold tracking-tight text-foreground">Syncing Project State</h2>
           <p className="text-sm text-muted-foreground">Preparing your executive clean-up workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden selection:bg-primary/10">
      {/* Header */}
      <header className="h-16 px-6 shrink-0 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between z-40">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/history" className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors group">
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-foreground truncate max-w-[200px] sm:max-w-md">
              {doc?.title}
              {brandProfileName ? (
                <span className="text-muted-foreground font-medium ml-2">· {brandProfileName}</span>
              ) : null}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{doc?.content_type?.replace(/_/g, " ") || "DOCUMENT"}</span>
              <span className="text-[10px] text-border">•</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clean-up Workspace</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden md:inline-flex items-center border border-gray-200 rounded-md overflow-hidden text-[12px] font-semibold"
            role="tablist"
            aria-label="View mode"
          >
            <button
              role="tab"
              aria-selected={viewMode === "changes"}
              onClick={() => setViewMode("changes")}
              className={`px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none ${
                viewMode === "changes" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-900"
              }`}
            >
              Changes
            </button>
            <button
              role="tab"
              aria-selected={viewMode === "diff"}
              onClick={() => setViewMode("diff")}
              className={`px-3 py-1.5 transition-colors border-l border-gray-200 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none ${
                viewMode === "diff" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-900"
              }`}
            >
              Diff
            </button>
          </div>
          <button
            onClick={() => setShowHistoryDrawer(true)}
            className="p-2 -m-2 text-gray-400 hover:text-gray-900 transition-colors rounded-md focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            aria-label="View revision history"
            title="Revision history"
          >
            <Clock size={18} />
          </button>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/analyse/${id}`)} className="rounded-full px-4">
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
              onClick={() => {
                if (id) router.push(`/export/${id}`);
              }}
              disabled={progressPercent < 100}
              className="rounded-full px-6 font-bold"
            >
              Export
            </Button>
          )}
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User size={16} className="text-muted-foreground/50" />
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-[3px] w-full bg-muted shrink-0">
        <div
          className="h-full bg-teal-500 transition-all duration-[600ms] ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Paragraph mismatch banner — AI merged or split paragraphs, so positional
          mapping may be imprecise. Surface this to the user rather than silently proceed. */}
      {paragraphMismatch && (
        <div className="shrink-0 px-4 sm:px-6 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2 text-[12px] text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Structure changed during clean-up — your original had {paragraphMismatch.originalCount} paragraph{paragraphMismatch.originalCount === 1 ? "" : "s"}, the cleaned version has {paragraphMismatch.cleanedCount}. Review carefully before exporting; you can edit any paragraph inline.
          </span>
        </div>
      )}

      {/* Main Content Areas */}
      <div className={`flex-1 flex overflow-hidden relative ${viewMode === "changes" ? "pt-[48px] md:pt-0" : ""}`}>

        {viewMode === "diff" && cleanup && (
          <DiffView paragraphs={cleanup.paragraphs as ParagraphType[]} />
        )}

        {viewMode === "changes" && (
        <>
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
        <div className={cn(
          "hidden md:flex flex-col border-r border-border bg-background overflow-hidden transition-all duration-200",
          collapsedCols.original ? "w-[32px] shrink-0" : "flex-1 min-w-0"
        )}>
          <div className="px-2 py-4 border-b border-border bg-muted/10 flex items-center justify-between shrink-0">
            {!collapsedCols.original && (
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Original Context</h2>
            )}
            <button
              onClick={() => toggleCol("original")}
              className="ml-auto flex items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={collapsedCols.original ? "Expand Original" : "Collapse Original"}
            >
              {collapsedCols.original ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
          {collapsedCols.original ? (
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest whitespace-nowrap -rotate-90">
                Original
              </span>
            </div>
          ) : (
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
          )}
        </div>

        {/* Column 2: Cleaned Version (Main) */}
        <div className={cn(
          "flex-1 flex flex-col bg-background overflow-hidden z-10 transition-all duration-300 shadow-2xl",
          activeTab === "cleaned" ? "flex" : "hidden md:flex"
        )}>
          <div className="hidden md:flex px-8 py-4 border-b border-border bg-muted/10">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cleaned Workspace</h2>
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
                  onRevert={handleRevert}
                  hasUserEdit={cleanup.user_edits?.some(e => e.paragraph_index === idx) || false}
                />
              ))}

              {progressPercent === 100 && (
                <div className="mt-12 p-8 border-2 border-dashed border-teal-100 rounded-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                  <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                    <CheckCircle size={24} className="text-teal-600" />
                  </div>
                  <h3 className="text-[18px] font-bold text-gray-900 mb-2">Clean-up complete!</h3>
                  <p className="text-[14px] text-gray-500 mb-6">You&apos;ve resolved all {diagnosis.issues.length} issues. Your document is ready to go.</p>
                  <Button variant="primary" size="lg" onClick={() => router.push(`/export/${id}`)}>
                    Go to Export <ArrowRight size={16} className="ml-2" />
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
                  <span
                    className="text-[12px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"
                    title="Live estimate based on issues resolved. Accurate score is calculated when you export."
                  >
                    Estimated Score
                    <Info size={11} className="text-gray-300" />
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[20px] font-bold text-gray-900">~{currentScore}</span>
                    <span className="text-[12px] font-bold text-teal-600">+{ (currentScore - (diagnosis.average_score_original || 0)).toFixed(1) }pts</span>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">Final score on export</span>
                </div>
              </div>
              <Button variant="secondary" size="md" onClick={handleAcceptRemaining}>
                Accept remaining changes
              </Button>
            </div>
          )}
        </div>

          {/* Column 3: Issue Queue (Desktop) */}
        <div className={cn(
          "hidden lg:flex flex-col overflow-hidden transition-all duration-200 bg-background border-l border-border",
          collapsedCols.queue ? "w-[32px] shrink-0" : "flex-1 min-w-0"
        )}>
          <div className="px-2 py-4 border-b border-border bg-muted/10 flex items-center justify-between shrink-0">
            <button
              onClick={() => toggleCol("queue")}
              className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title={collapsedCols.queue ? "Expand Queue" : "Collapse Queue"}
            >
              {collapsedCols.queue ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            {!collapsedCols.queue && (
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Critical Queue</h2>
            )}
          </div>
          {collapsedCols.queue ? (
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest whitespace-nowrap rotate-90">
                Queue
              </span>
            </div>
          ) : (
            <IssueQueue 
              issues={diagnosis.issues as unknown as DiagnosisIssue[]}
              resolvedIssueIndices={resolvedIssueIndices}
              activeIssueIndex={null}
              onIssueClick={(idx) => {
                const pIdx = issueToParagraphMap.get(idx);
                if (pIdx !== undefined) {
                  setActiveTab("cleaned");
                  scrollToParagraph(pIdx);
                }
              }}
            />
          )}
        </div>

        </>
        )}

        {/* Column 4: Drawer (Desktop) */}
        <ExplanationDrawer
          isOpen={!!activeDrawerTag}
          onClose={() => setActiveDrawerTag(null)}
          tag={activeDrawerTag}
        />

        {cleanup && (
          <RevisionHistoryDrawer
          cleanupId={cleanup.id}
          isOpen={showHistoryDrawer}
          onClose={() => setShowHistoryDrawer(false)}
          onRestore={handleRestoreRevision}
        />
        )}

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
