"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CleanupParagraph } from "@/lib/anthropic/types";
import { UserEdit, Database } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { 
  X, 
  RotateCcw, 
  Sparkles, 
  Pencil, 
  HelpCircle, 
  SkipForward, 
  CheckCheck, 
  History,
  Calendar,
  ChevronRight,
  type LucideIcon 
} from "lucide-react";

type Revision = Database["public"]["Tables"]["cleanup_revisions"]["Row"];

interface RevisionHistoryDrawerProps {
  cleanupId: string;
  isOpen: boolean; // Corrected prop name to match parent
  onClose: () => void;
  onRestore: (paragraphs: CleanupParagraph[], userEdits: UserEdit[]) => Promise<void>;
}

const EVENT_LABELS: Record<string, string> = {
  ai_initial: "Candour AI Baseline",
  user_edit: "Manual Intervention",
  pause_resolved: "Structural Fact Integrated",
  pause_skipped: "Prompt Bypassed",
  revert: "Algorithmic Restoration",
  accept_remaining: "Bulk Approval Verified",
};

const EVENT_ICONS: Record<string, LucideIcon> = {
  ai_initial: Sparkles,
  user_edit: Pencil,
  pause_resolved: HelpCircle,
  pause_skipped: SkipForward,
  revert: RotateCcw,
  accept_remaining: CheckCheck,
};

const EVENT_COLORS: Record<string, string> = {
  ai_initial: "text-primary bg-primary/10 border-primary/20",
  user_edit: "text-secondary bg-secondary/10 border-secondary/20",
  pause_resolved: "text-green-500 bg-green-500/10 border-green-500/20",
  pause_skipped: "text-muted-foreground bg-muted border-border",
  revert: "text-accent bg-accent/10 border-accent/20",
  accept_remaining: "text-primary bg-primary/10 border-primary/20",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RevisionHistoryDrawer({ cleanupId, isOpen, onClose, onRestore }: RevisionHistoryDrawerProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("cleanup_revisions")
      .select("*")
      .eq("cleanup_id", cleanupId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRevisions(data || []);
        setLoading(false);
      });
  }, [isOpen, cleanupId]);

  if (!isOpen) return null;

  const handleRestore = async (rev: Revision) => {
    // Custom premium confirmation look instead of window.confirm would be better, but keeping for logic
    if (!confirm("Are you sure you want to restore this revision? Your current changes will be saved as a new version.")) return;
    
    setRestoringId(rev.id);
    try {
      await onRestore(rev.paragraphs as CleanupParagraph[], rev.user_edits as UserEdit[]);
      onClose();
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      {/* Premium Backdrop */}
      <div
        className="fixed inset-0 bg-background/40 backdrop-blur-sm z-[100] animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* Modern Audit Drawer */}
      <aside
        className={cn(
          "fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-card border-l border-border shadow-2xl z-[101] flex flex-col transition-all duration-500 ease-out",
          "animate-in slide-in-from-right"
        )}
        role="dialog"
      >
        <header className="flex items-center justify-between px-8 h-24 border-b border-border bg-background/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <History size={24} />
             </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold tracking-tight text-foreground">Project Audit Trail</h2>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                     {revisions.length} Registered Mutations
                   </span>
                </div>
              </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded-full transition-all text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-60 gap-4 opacity-50">
              <Spinner />
               <span className="text-[10px] font-bold uppercase tracking-widest">Compiling Delta History...</span>
            </div>
          ) : revisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-center space-y-4 opacity-40">
               <Calendar size={32} strokeWidth={1} />
               <p className="text-sm font-medium max-w-[200px]">No revision records identified for this session.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical Timeline Line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-border/50" />
              
              <ul className="space-y-10">
                {revisions.map((rev, i) => {
                  const Icon = EVENT_ICONS[rev.event_type] || Pencil;
                  const isLatest = i === 0;
                  const colorClass = EVENT_COLORS[rev.event_type] || "text-muted-foreground bg-muted border-border";
                  
                  return (
                    <li key={rev.id} className="relative flex items-start gap-6 group">
                      <div className={cn(
                        "relative z-10 w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-300",
                        isLatest ? "scale-110 shadow-xl shadow-primary/10" : "group-hover:scale-105 shadow-lg shadow-black/5",
                        colorClass
                      )}>
                        <Icon size={18} strokeWidth={2.5} />
                      </div>

                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                             <span className={cn(
                               "text-[13px] font-bold",
                               isLatest ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                             )}>
                               {EVENT_LABELS[rev.event_type] || rev.event_type}
                             </span>
                             {isLatest && (
                               <div className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-[8px] font-bold tracking-widest border border-green-500/20">
                                 HEAD
                               </div>
                             )}
                           </div>
                           <p className="text-[11px] font-medium text-muted-foreground/60 flex items-center gap-2">
                             {formatRelative(rev.created_at)}
                             <span className="opacity-30">•</span>
                             {new Date(rev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </p>
                        </div>
                        
                        {!isLatest && (
                          <div className="mt-4">
                            <button
                              onClick={() => handleRestore(rev)}
                              disabled={restoringId === rev.id}
                               className="group/btn flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-[11px] font-bold text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-all active:scale-95 disabled:opacity-50"
                            >
                              {restoringId === rev.id ? (
                                <>
                                  <Spinner size="sm" />
                                  Synthesizing State...
                                </>
                              ) : (
                                <>
                                  Restore Version
                                  <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-8 border-t border-border bg-muted/20">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                 <RotateCcw size={14} />
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight font-medium">
                Restoring an earlier state will append a new revision to preserve current progress.
              </p>
           </div>
        </div>
      </aside>
    </>
  );
}
