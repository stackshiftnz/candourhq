import React from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { getScoreColour } from "@/lib/utils/score-colour";
import {
  BarChart3,
  Target,
  Feather,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Tags
} from "lucide-react";
import { Database } from "@/types/database";
import { DiagnosisIssue, CleanupParagraph, IssueCategory, ChangeTagType } from "@/lib/anthropic/types";

type Diagnosis = Database["public"]["Tables"]["diagnoses"]["Row"];
type Cleanup = Database["public"]["Tables"]["cleanups"]["Row"];

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  certainty_risk: "Certainty Risk",
  unsupported_claim: "Unsupported Claim",
  low_specificity: "Low Specificity",
  low_density: "Low Density",
  no_evidence: "No Evidence",
  ai_cliche: "AI Cliché",
  redundant_list: "Redundant List",
  repetition: "Repetition",
  generic_phrasing: "Generic Phrasing",
  brand_mismatch: "Brand Mismatch",
};

const CHANGE_TAG_LABELS: Record<ChangeTagType, string> = {
  tightened: "Tightened",
  made_specific: "Made Specific",
  hedge_removed: "Hedge Removed",
  brand_voice: "Brand Voice",
  cliche_removed: "Cliché Removed",
  softened: "Softened",
  fact_added: "Fact Added",
};

interface FinalScores {
  substance: number;
  style: number;
  trust: number;
  average: number;
}

interface StatsDashboardProps {
  diagnosis: Diagnosis;
  cleanup: Cleanup;
  finalScores: FinalScores | null;
  rescoreLoading: boolean;
  rescoreError: boolean;
}

interface ScoreRowProps {
  label: string;
  icon: React.ReactNode;
  original: number;
  final: number | null;
  loading: boolean;
  error: boolean;
}

function ScoreRow({ label, icon, original, final, loading, error }: ScoreRowProps) {
  const delta = final !== null ? final - original : null;
  return (
    <div className="flex items-center gap-4 py-3 px-5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2.5 w-28 shrink-0">
        <span className="text-muted-foreground/50">{icon}</span>
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-3 flex-1">
        <span className="text-[13px] font-bold text-muted-foreground/40 tabular-nums line-through">
          {original.toFixed(1)}
        </span>
        <ArrowRight size={10} className="text-muted-foreground/20 shrink-0" />
        {loading ? (
          <Spinner size="sm" className="text-muted-foreground/30" />
        ) : error && final === null ? (
          <span className="text-[13px] font-bold text-muted-foreground/30 tabular-nums">{original.toFixed(1)}</span>
        ) : final !== null ? (
          <span className={cn("text-[14px] font-bold tabular-nums", getScoreColour(final))}>
            {final.toFixed(1)}
          </span>
        ) : (
          <span className="text-[13px] font-bold text-muted-foreground/20 tabular-nums">—</span>
        )}
        {delta !== null && delta !== 0 && (
          <span className={cn(
            "text-[10px] font-bold ml-auto tabular-nums",
            delta > 0 ? "text-green-500" : "text-accent"
          )}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatsDashboard({
  diagnosis,
  cleanup,
  finalScores,
  rescoreLoading,
  rescoreError,
}: StatsDashboardProps) {
  const issues = (diagnosis.issues as unknown as DiagnosisIssue[]) || [];
  const paragraphs = (cleanup.paragraphs as unknown as CleanupParagraph[]) || [];

  const issuesByCategory = React.useMemo(() => {
    const counts: Partial<Record<IssueCategory, number>> = {};
    for (const issue of issues) {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a) as [IssueCategory, number][];
  }, [issues]);

  const changesByTag = React.useMemo(() => {
    const counts: Partial<Record<ChangeTagType, number>> = {};
    for (const para of paragraphs) {
      for (const change of para.changes || []) {
        counts[change.tag] = (counts[change.tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a) as [ChangeTagType, number][];
  }, [paragraphs]);

  const totalChanges = changesByTag.reduce((sum, [, n]) => sum + n, 0);

  const issuesTotal = cleanup.issues_total || 0;
  const issuesResolved = cleanup.issues_resolved || 0;
  const resolutionPct = issuesTotal > 0 ? Math.round((issuesResolved / issuesTotal) * 100) : 0;

  const avgDelta = finalScores
    ? finalScores.average - (diagnosis.average_score_original || 0)
    : null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3 px-1">
        <BarChart3 size={16} className="text-muted-foreground" />
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Quality Improvement Report
        </h2>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border-b border-border">
          {[
            {
              label: "Issues Found",
              value: issuesTotal,
              icon: <AlertCircle size={14} className="text-muted-foreground/50" />,
            },
            {
              label: "Resolved",
              value: `${issuesResolved} / ${issuesTotal}`,
              icon: <CheckCircle2 size={14} className="text-green-500/70" />,
            },
            {
              label: "Resolution Rate",
              value: `${resolutionPct}%`,
              icon: <TrendingUp size={14} className="text-primary/70" />,
              highlight: resolutionPct === 100,
            },
            {
              label: "Score Lift",
              value: rescoreLoading
                ? "…"
                : avgDelta !== null
                ? `${avgDelta > 0 ? "+" : ""}${avgDelta.toFixed(1)}`
                : "—",
              icon: <BarChart3 size={14} className="text-muted-foreground/50" />,
              highlight: (avgDelta ?? 0) > 0,
            },
          ].map(({ label, value, icon, highlight }) => (
            <div key={label} className="px-5 py-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground/60">
                {icon}
                <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
              </div>
              <span className={cn(
                "text-xl font-bold tabular-nums tracking-tight",
                highlight ? "text-green-500" : "text-foreground"
              )}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        <div>
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Score Breakdown — Before &amp; After
            </span>
          </div>
          <ScoreRow
            label="Substance"
            icon={<Target size={12} />}
            original={diagnosis.substance_score || 0}
            final={finalScores?.substance ?? null}
            loading={rescoreLoading}
            error={rescoreError}
          />
          <ScoreRow
            label="Style"
            icon={<Feather size={12} />}
            original={diagnosis.style_score || 0}
            final={finalScores?.style ?? null}
            loading={rescoreLoading}
            error={rescoreError}
          />
          <ScoreRow
            label="Trust"
            icon={<ShieldAlert size={12} />}
            original={diagnosis.trust_score || 0}
            final={finalScores?.trust ?? null}
            loading={rescoreLoading}
            error={rescoreError}
          />
          <div className="px-5 py-3 bg-muted/20 flex items-center justify-between border-t border-border">
            <span className="text-[11px] font-bold text-foreground">Overall Average</span>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-bold text-muted-foreground/40 tabular-nums line-through">
                {(diagnosis.average_score_original || 0).toFixed(1)}
              </span>
              <ArrowRight size={10} className="text-muted-foreground/20" />
              {rescoreLoading ? (
                <Spinner size="sm" className="text-muted-foreground/30" />
              ) : rescoreError && !finalScores ? (
                <span className="text-[15px] font-bold text-muted-foreground/30 tabular-nums">
                  {(diagnosis.average_score_original || 0).toFixed(1)}
                </span>
              ) : finalScores ? (
                <span className={cn("text-[16px] font-bold tabular-nums", getScoreColour(finalScores.average))}>
                  {finalScores.average.toFixed(1)}
                </span>
              ) : (
                <span className="text-[15px] font-bold text-muted-foreground/20">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Issues by category */}
        {issuesByCategory.length > 0 && (
          <div>
            <div className="px-5 py-3 border-t border-b border-border bg-muted/30">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Issues by Type
              </span>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-2">
              {issuesByCategory.map(([category, count]) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-[10px] font-semibold text-foreground/80"
                >
                  {CATEGORY_LABELS[category]}
                  <span className="text-muted-foreground font-bold">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Changes applied */}
        {changesByTag.length > 0 && (
          <div>
            <div className="px-5 py-3 border-t border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Changes Applied
              </span>
              <div className="flex items-center gap-1.5 text-muted-foreground/50">
                <Tags size={11} />
                <span className="text-[10px] font-bold">{totalChanges} total</span>
              </div>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-2">
              {changesByTag.map(([tag, count]) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/15 text-[10px] font-semibold text-primary/80"
                >
                  {CHANGE_TAG_LABELS[tag]}
                  <span className="text-primary/50 font-bold">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
