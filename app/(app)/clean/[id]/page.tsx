"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database";
import { CleanupParagraph as ParagraphType } from "@/lib/anthropic/types";
import { CleanupParagraph } from "@/components/cleanup/CleanupParagraph";
import { CleanupTopBar } from "@/components/cleanup/CleanupTopBar";
import { TransformationView } from "@/components/cleanup/TransformationView";
import { RevisionHistoryDrawer } from "@/components/cleanup/RevisionHistoryDrawer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/hooks/useToast";
import {
  CircleAlert,
  Clock,
  Layers,
  ChevronLeft,
} from "lucide-react";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];

export default function CleanupPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : (Array.isArray(params.id) ? params.id[0] : "");
  const searchParams = useSearchParams();
  const ambition = searchParams.get("ambition") || "conservative";
  const selectedIssueIds = useMemo(
    () => searchParams.get("selectedIssues")?.split(",").filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()]
  );
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  // ── Core data ───────────────────────────────────────────────────────────────
  const [doc, setDoc] = useState<Document | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [brandProfileName, setBrandProfileName] = useState<string | null>(null);
  const [savedFacts, setSavedFacts] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Paragraph state ─────────────────────────────────────────────────────────
  const [paragraphs, setParagraphs] = useState<ParagraphType[]>([]);
  const [cleanupId, setCleanupId] = useState<string | null>(null);
  const [userEditIndices, setUserEditIndices] = useState<Set<number>>(new Set());

  // ── Stream state ────────────────────────────────────────────────────────────
  const [streamRunning, setStreamRunning] = useState(false);
  const [streamComplete, setStreamComplete] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [isStalled, setIsStalled] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hardTimeout, setHardTimeout] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"original" | "cleanup">("cleanup");
  const [expandedTagKey, setExpandedTagKey] = useState<string | null>(null);
  const [focusedParagraphIndex, setFocusedParagraphIndex] = useState<number | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const streamStartedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const originalParagraphs = useMemo(() => {
    if (!doc?.original_content) return [];
    return doc.original_content.trim().split(/\n\s*\n/).filter((p) => p.trim());
  }, [doc?.original_content]);

  const resolvedCount = useMemo(
    () => paragraphs.filter((p) => p.type === "clean").length,
    [paragraphs]
  );
  const totalCount = paragraphs.length;
  const pauseCardsRemaining = useMemo(
    () => paragraphs.filter((p) => p.type === "pause").length,
    [paragraphs]
  );
  const progressPercent = totalCount > 0
    ? Math.round((resolvedCount / totalCount) * 100)
    : 0;

  const originalScore = (diagnosis as any)?.average_score_original ?? 0;
  const finalScore: number | null = (diagnosis as any)?.average_score_final ?? null;

  // ── Stream ──────────────────────────────────────────────────────────────────

  const startStream = useCallback(async () => {
    if (!id || !doc) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStreamRunning(true);
    setStreamError(null);
    setStreamProgress(0);
    setIsStalled(false);

    const resetStall = () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      setIsStalled(false);
      stallTimerRef.current = setTimeout(() => setIsStalled(true), 45_000);
    };

    const hardTimer = setTimeout(() => {
      setHardTimeout(true);
      setStreamRunning(false);
      controller.abort();
    }, 180_000);

    resetStall();

    try {
      const res = await fetch("/api/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id, ambition, selectedIssueIds }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let evtName = "";
      let evtData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            evtName = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            evtData = line.slice(6).trim();
          } else if (line === "" && evtName && evtData) {
            try {
              const parsed = JSON.parse(evtData);

              if (evtName === "paragraph") {
                resetStall();
                setParagraphs((prev) => {
                  const next = [...prev];
                  next[parsed.index] = parsed.paragraph;
                  return next;
                });
              } else if (evtName === "progress") {
                resetStall();
                setStreamProgress(Math.min(99, Math.round((parsed.emitted / parsed.expected) * 100)));
              } else if (evtName === "complete") {
                clearTimeout(hardTimer);
                if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
                setStreamComplete(true);
                setStreamRunning(false);
                setStreamProgress(100);
                setCleanupId(parsed.id);
              } else if (evtName === "error") {
                clearTimeout(hardTimer);
                if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
                setStreamError(parsed.error || "An unexpected error occurred.");
                setStreamRunning(false);
              }
            } catch {
              // malformed JSON event — ignore
            }
            evtName = "";
            evtData = "";
          }
        }
      }
    } catch (err: unknown) {
      clearTimeout(hardTimer);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (!(err instanceof Error && err.name === "AbortError")) {
        setStreamError("Connection lost. Please try again.");
        setStreamRunning(false);
      }
    }
  }, [id, ambition, selectedIssueIds, doc]);

  // ── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: docData, error: docError } = await supabase
        .from("documents")
        .select("*, workspaces(*), brand_profiles(*)")
        .eq("id", id)
        .single();

      if (docError || !docData) {
        setError("Failed to load document.");
        setLoading(false);
        return;
      }

      setDoc(docData as unknown as Document);
      setBrandProfileName((docData as any).brand_profiles?.name || null);
      setSavedFacts((docData as any).brand_profiles?.saved_facts || []);

      const { data: diagData, error: diagError } = await supabase
        .from("diagnoses")
        .select("*")
        .eq("document_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (diagError || !diagData) {
        setError("Document diagnosis not found. Please run analysis first.");
        setLoading(false);
        return;
      }

      setDiagnosis(diagData as unknown as Diagnosis);

      // Check for existing cleanup (page revisit)
      const { data: cleanupData } = await supabase
        .from("cleanups")
        .select("*")
        .eq("document_id", id)
        .maybeSingle();

      if (cleanupData) {
        setParagraphs((cleanupData.paragraphs || []) as ParagraphType[]);
        setCleanupId(cleanupData.id);
        setUserEditIndices(
          new Set(((cleanupData.user_edits || []) as any[]).map((e) => e.paragraph_index as number))
        );
        setStreamComplete(true);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger stream when doc is loaded and no existing cleanup
  useEffect(() => {
    if (!doc || loading || streamStartedRef.current || streamComplete || cleanupId) return;
    streamStartedRef.current = true;
    startStream();
  }, [doc, loading, streamComplete, cleanupId, startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleParagraphFocus = useCallback((idx: number | null) => {
    setFocusedParagraphIndex(idx);
    if (idx !== null) {
      document
        .getElementById(`original-para-${idx}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleEdit = useCallback(async (idx: number, newText: string) => {
    if (!cleanupId) return;

    const updated = paragraphs.map((p, i) =>
      i === idx && p.type === "clean" ? { ...p, cleaned: newText } : p
    );
    setParagraphs(updated);
    setUserEditIndices((prev) => new Set([...prev, idx]));
    await supabase.from("cleanups").update({ paragraphs: updated }).eq("id", cleanupId);
  }, [cleanupId, paragraphs, supabase]);

  const handleResolvePause = useCallback(async (idx: number, answer: string | null, skipped: boolean) => {
    if (!cleanupId) return;

    const updated = [...paragraphs];
    const p = updated[idx];
    if (p?.type !== "pause") return;

    updated[idx] = {
      ...p,
      type: "clean",
      cleaned: answer || p.original,
      pause_card: p.pause_card ? { ...p.pause_card, user_answer: answer, skipped } : null,
    };

    setParagraphs(updated);
    await supabase.from("cleanups").update({ paragraphs: updated }).eq("id", cleanupId);
    toast(skipped ? "Intervention skipped." : "Context integrated.", "success");
  }, [cleanupId, paragraphs, supabase, toast]);

  const handleAcceptRemaining = useCallback(async () => {
    if (!cleanupId) return;

    const updated = paragraphs.map((p) =>
      p.type === "pause" ? { ...p, type: "clean" as const, cleaned: p.original } : p
    );

    setParagraphs(updated);
    await supabase.from("cleanups").update({ paragraphs: updated }).eq("id", cleanupId);
    toast("All remaining paragraphs accepted.", "success");
  }, [cleanupId, paragraphs, supabase, toast]);

  const handleRevert = useCallback(async (idx: number) => {
    setUserEditIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
    toast("Reverted to AI version.", "success");
  }, [toast]);

  const handleRestoreRevision = useCallback(async (newParagraphs: ParagraphType[]) => {
    if (!cleanupId) return;
    setParagraphs(newParagraphs);
    await supabase.from("cleanups").update({ paragraphs: newParagraphs }).eq("id", cleanupId);
    toast("Revision restored.", "success");
  }, [cleanupId, supabase, toast]);

  const handleRetry = () => {
    streamStartedRef.current = false;
    setStreamError(null);
    setHardTimeout(false);
    setStreamProgress(0);
    setParagraphs([]);
    startStream();
  };

  // ── Render guards ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center text-accent">
          <CircleAlert size={40} strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Critical Error</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{error}</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="primary" className="px-10 rounded-full">
          Reload
        </Button>
      </div>
    );
  }

  if (hardTimeout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-secondary/10 flex items-center justify-center text-secondary">
          <Clock size={40} strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Generation Timed Out</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            This document took too long to process. Your original content is preserved.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRetry} variant="primary" className="px-8 rounded-full">
            Retry
          </Button>
          <Link href={`/analyse/${id}`}>
            <Button variant="secondary" className="px-8 rounded-full">Return to Analysis</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !doc || !diagnosis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <div className="relative w-24 h-24 mb-12">
          <div className="absolute inset-0 rounded-[38%] border-[6px] border-primary/20 animate-[spin_4s_linear_infinite]" />
          <div className="absolute inset-0 rounded-[38%] border-[6px] border-primary border-t-transparent animate-[spin_2.5s_linear_infinite]" />
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Layers size={36} className="animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold tracking-tight">Loading workspace…</h2>
          <p className="text-sm text-muted-foreground">Synchronising intelligence models...</p>
        </div>
      </div>
    );
  }

  // Streaming (no paragraphs yet or stream running before first paragraph)
  if (streamRunning && paragraphs.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <header className="h-14 px-6 border-b border-border bg-background/50 backdrop-blur-md flex items-center gap-4 shrink-0">
          <Link href={`/analyse/${id}`} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-xl text-muted-foreground transition-all border border-border">
            <ChevronLeft size={16} />
          </Link>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Step 2 of 2</p>
            <p className="text-[13px] font-bold text-foreground truncate max-w-sm">{doc.title}</p>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-12">
          <TransformationView
            brandProfileName={brandProfileName}
            progress={streamProgress}
            isTakingLong={streamProgress === 0 && !isStalled}
            isStalled={isStalled}
          />
        </div>
      </div>
    );
  }

  // Stream error state
  if (streamError && !streamRunning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center text-accent">
          <CircleAlert size={40} strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Generation Failed</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{streamError}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRetry} variant="primary" className="px-8 rounded-full">
            Retry
          </Button>
          <Link href={`/analyse/${id}`}>
            <Button variant="secondary" className="px-8 rounded-full">Return to Analysis</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Main workspace layout ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Mobile tab bar */}
      <div className="lg:hidden shrink-0 flex border-b border-border bg-background">
        {(["original", "cleanup"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 h-11 text-[10px] font-bold uppercase tracking-widest transition-all",
              activeTab === tab
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground"
            )}
          >
            {tab === "original" ? "Original" : `Clean-up${paragraphs.length > 0 ? ` (${resolvedCount}/${totalCount})` : ""}`}
          </button>
        ))}
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — original reference */}
        <div className={cn(
          "lg:w-[45%] lg:flex flex-col border-r border-border/50 overflow-hidden",
          activeTab === "original" ? "flex" : "hidden"
        )}>
          <div className="px-4 py-3 border-b border-border/50 shrink-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
              Original
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-0 custom-scrollbar">
            {originalParagraphs.map((text, idx) => (
              <div
                key={idx}
                id={`original-para-${idx}`}
                className={cn(
                  "py-4 pl-4 border-l-2 transition-all duration-300 rounded-r-sm",
                  focusedParagraphIndex === idx
                    ? "border-primary bg-primary/[0.03]"
                    : "border-transparent"
                )}
              >
                <p className="text-[14px] lg:text-[15px] text-foreground/70 font-medium leading-relaxed">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL — cleanup workspace */}
        <div className={cn(
          "lg:flex-1 flex flex-col overflow-hidden",
          activeTab === "cleanup" ? "flex" : "hidden lg:flex"
        )}>
          <CleanupTopBar
            documentTitle={doc.title || "Document"}
            progressPercent={progressPercent}
            resolvedCount={resolvedCount}
            totalCount={totalCount}
            originalScore={originalScore}
            finalScore={finalScore}
            streamComplete={streamComplete}
            pauseCardsRemaining={pauseCardsRemaining}
            onExport={() => router.push(`/export/${id}`)}
            onHistory={() => setShowHistoryDrawer(true)}
            onBack={() => router.push(`/analyse/${id}`)}
            onAcceptRemaining={handleAcceptRemaining}
          />

          {/* Streaming progress bar (only during active stream) */}
          {streamRunning && (
            <div className="h-0.5 w-full bg-muted shrink-0">
              <div
                className="h-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${streamProgress}%` }}
              />
            </div>
          )}

          {/* Paragraph list */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 custom-scrollbar">
            <div className="max-w-[680px] mx-auto">
              {paragraphs.map((p, idx) => (
                <CleanupParagraph
                  key={idx}
                  paragraph={p}
                  index={idx}
                  expandedTagKey={expandedTagKey}
                  onTagExpand={setExpandedTagKey}
                  onEdit={handleEdit}
                  onResolvePause={handleResolvePause}
                  hasUserEdit={userEditIndices.has(idx)}
                  onRevert={handleRevert}
                  onHoverIn={() => handleParagraphFocus(idx)}
                  onHoverOut={() => setFocusedParagraphIndex(null)}
                  savedFacts={savedFacts}
                />
              ))}

              {/* Stall warning inline (during stream with partial paragraphs) */}
              {streamRunning && isStalled && (
                <div className="mt-4 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[12px] text-amber-600 font-medium animate-in fade-in duration-300">
                  Still generating — large documents can take a moment.
                </div>
              )}

              {/* Completion state */}
              {streamComplete && progressPercent === 100 && (
                <div className="mt-8 p-8 border border-dashed border-primary/15 rounded-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-500 bg-primary/[0.02]">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary border border-primary/20">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2 tracking-tight">Clean-up Complete</h3>
                  <p className="text-[13px] text-muted-foreground mb-6 max-w-xs leading-relaxed">
                    All paragraphs have been addressed. Export when ready.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => router.push(`/export/${id}`)}
                    className="rounded-xl px-8 h-11 font-bold"
                  >
                    Export Document
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {cleanupId && (
        <RevisionHistoryDrawer
          cleanupId={cleanupId}
          isOpen={showHistoryDrawer}
          onClose={() => setShowHistoryDrawer(false)}
          onRestore={handleRestoreRevision}
        />
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.06); border-radius: 20px; }
      `}</style>
    </div>
  );
}
