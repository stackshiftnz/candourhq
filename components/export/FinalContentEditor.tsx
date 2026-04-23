"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Copy, CheckCircle, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/useToast";
import { Database } from "@/types/database";
import { CleanupParagraph } from "@/lib/anthropic/types";

type Cleanup = Database["public"]["Tables"]["cleanups"]["Row"];

interface FinalContentEditorProps {
  cleanup: Cleanup;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function deriveFinalContent(cleanup: Cleanup): string {
  if (cleanup.final_content) return cleanup.final_content;
  const paragraphs = (cleanup.paragraphs as unknown as CleanupParagraph[]) || [];
  return paragraphs
    .map((p) => {
      if (p.type === "clean") return p.cleaned || "";
      if (p.type === "pause") return p.original || "";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function FinalContentEditor({ cleanup }: FinalContentEditorProps) {
  const [content, setContent] = useState(() => deriveFinalContent(cleanup));
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const wordCount = countWords(content);

  // Persist derived content on first load if final_content wasn't already stored
  useEffect(() => {
    if (!cleanup.final_content && content) {
      supabase
        .from("cleanups")
        .update({ final_content: content })
        .eq("id", cleanup.id)
        .then(({ error }) => {
          if (error) console.error("Failed to persist derived final_content", error);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
      toast("Content copied to clipboard", "success");
    } catch {
      toast("Failed to copy — please select and copy manually", "error");
    }
  };

  const handleBlur = useCallback(async () => {
    // Save if content differs from what's stored (covers both edits and first-time derivation)
    if (content === (cleanup.final_content || "")) return;
    setSaving(true);
    const { error } = await supabase
      .from("cleanups")
      .update({ final_content: content })
      .eq("id", cleanup.id);
    setSaving(false);
    if (error) {
      toast("Failed to save changes", "error");
    }
  }, [content, cleanup.final_content, cleanup.id, supabase, toast]);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <FileEdit size={16} className="text-muted-foreground" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Finalised Content
          </h2>
          <span className="text-[10px] font-semibold text-muted-foreground/50 bg-muted px-2 py-0.5 rounded-full">
            {wordCount.toLocaleString()} words
          </span>
          {saving && (
            <span className="text-[10px] text-muted-foreground/50 animate-pulse">Saving…</span>
          )}
        </div>
        <Button
          onClick={handleCopy}
          variant={copyStatus === "copied" ? "secondary" : "primary"}
          size="sm"
          className="h-9 px-4 rounded-xl font-bold text-[11px] gap-2 transition-all"
        >
          {copyStatus === "copied" ? (
            <>
              <CheckCircle size={13} />
              Copied
            </>
          ) : (
            <>
              <Copy size={13} />
              Copy to Clipboard
            </>
          )}
        </Button>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          rows={22}
          spellCheck
          className="w-full resize-y rounded-2xl border border-border bg-card px-6 py-5 text-sm text-foreground leading-relaxed font-normal placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-sm"
          placeholder="Finalised content will appear here…"
        />
      </div>
    </section>
  );
}
