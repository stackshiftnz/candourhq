"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CleanupParagraph } from "@/lib/anthropic/types";
import { UserEdit, Database } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { XIcon, RotateCcwIcon, SparklesIcon, PencilIcon, HelpCircleIcon, SkipForwardIcon, CheckCheckIcon, type LucideIcon } from "lucide-react";

type Revision = Database["public"]["Tables"]["cleanup_revisions"]["Row"];

interface RevisionHistoryDrawerProps {
  cleanupId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (paragraphs: CleanupParagraph[], userEdits: UserEdit[]) => Promise<void>;
}

const EVENT_LABELS: Record<string, string> = {
  ai_initial: "Candour AI first draft",
  user_edit: "Manual edit",
  pause_resolved: "Pause card answered",
  pause_skipped: "Pause card skipped",
  revert: "Revert to AI version",
  accept_remaining: "Accepted remaining issues",
};

const EVENT_ICONS: Record<string, LucideIcon> = {
  ai_initial: SparklesIcon,
  user_edit: PencilIcon,
  pause_resolved: HelpCircleIcon,
  pause_skipped: SkipForwardIcon,
  revert: RotateCcwIcon,
  accept_remaining: CheckCheckIcon,
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

export function RevisionHistoryDrawer({ cleanupId, open, onClose, onRestore }: RevisionHistoryDrawerProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, cleanupId]);

  if (!open) return null;

  const handleRestore = async (rev: Revision) => {
    if (!confirm("Restore this version? Your current edits will become a new revision in the history.")) return;
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
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Revision history"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900">Revision history</h2>
            <p className="text-[12px] text-gray-500">{revisions.length} {revisions.length === 1 ? "entry" : "entries"}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 p-2 -m-2 rounded-md"
            aria-label="Close revision history"
          >
            <XIcon size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner />
            </div>
          ) : revisions.length === 0 ? (
            <p className="text-center text-[13px] text-gray-500 p-8">No revisions yet. Edits and pause card answers will appear here.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {revisions.map((rev, i) => {
                const Icon = EVENT_ICONS[rev.event_type] || PencilIcon;
                const isLatest = i === 0;
                return (
                  <li key={rev.id} className="px-5 py-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                      <Icon size={14} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-gray-900">
                          {EVENT_LABELS[rev.event_type] || rev.event_type}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5">
                        {formatRelative(rev.created_at)} · {new Date(rev.created_at).toLocaleString()}
                      </p>
                      {!isLatest && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-2"
                          onClick={() => handleRestore(rev)}
                          disabled={restoringId === rev.id}
                        >
                          {restoringId === rev.id ? "Restoring..." : "Restore this version"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
