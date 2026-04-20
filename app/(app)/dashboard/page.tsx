import { createClient } from "@/lib/supabase/server-user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatRelativeTime, getGreeting } from "@/lib/utils/format";
import { DiagnosisIssue } from "@/types/database";
import { Button as UiButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  FileText, 
  CircleCheck, 
  ArrowUpRight, 
  CircleAlert,
  TrendingUp,
  ChevronRight 
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  certainty_risk: "Certainty risk",
  unsupported_claim: "Unsupported claims",
  low_specificity: "Low specificity",
  low_density: "Low density",
  no_evidence: "No evidence",
  ai_cliche: "AI clichés",
  redundant_list: "Redundant phrasing",
  repetition: "Repetition",
  generic_phrasing: "Generic phrasing",
  brand_mismatch: "Brand mismatch",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog post",
  email: "Email",
  report: "Report",
  proposal: "Proposal",
  press_release: "Press release",
  social_post: "Social post",
  memo: "Memo",
};

const CATEGORY_PRIORITY: Record<string, "trust" | "substance" | "style"> = {
  certainty_risk: "trust",
  unsupported_claim: "trust",
  brand_mismatch: "trust",
  low_specificity: "substance",
  low_density: "substance",
  no_evidence: "substance",
  ai_cliche: "style",
  redundant_list: "style",
  repetition: "style",
  generic_phrasing: "style",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDocumentHref(status: string, id: string): string {
  switch (status) {
    case "exported":
      return `/export/${id}`;
    case "cleaned":
    case "cleaning":
    case "submitted":
    case "approved":
      return `/clean/${id}`;
    case "diagnosed":
      return `/analyse/${id}`;
    default:
      return `/analyse/${id}`;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "cleaning":
      return "In progress";
    case "diagnosed":
      return "Diagnosed";
    case "cleaned":
      return "Cleaned";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Inline SVGs
// ---------------------------------------------------------------------------

const DocIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-gray-300 flex-shrink-0"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const userId = user.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  // Use UTC hour — close enough for a greeting; avoids a client-side round-trip
  // REMOVED server side hour logic for client side greeting

  // ------------------------------------------------------------------
  // Queries (run in parallel)
  // ------------------------------------------------------------------
  const [
    { data: profile },
    { data: allDocsMeta },
    { data: brandProfiles },
    { data: recentDocsRaw },
    { data: cleanupResult },
    { data: diagnosesResult },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).single(),

    // All docs metadata for metric computation
    supabase
      .from("documents")
      .select("id, status, created_at")
      .eq("user_id", userId),

    // All brand profiles
    supabase
      .from("brand_profiles")
      .select("id, name, tone, language_variant, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),

    // Recent 4 docs with joined diagnosis scores and brand profile name
    supabase
      .from("documents")
      .select(
        "id, title, content_type, word_count, status, updated_at, diagnoses(average_score_original, average_score_final), brand_profiles(name)"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(4),

    // cleanups
    supabase
      .from("cleanups")
      .select("issues_resolved, document_id, documents!inner(user_id)")
      .eq("documents.user_id", userId),

    // diagnoses
    supabase
      .from("diagnoses")
      .select(
        "average_score_original, average_score_final, issues, document_id, documents!inner(user_id)"
      )
      .eq("documents.user_id", userId),
  ]);

  const inProgressCount =
    allDocsMeta?.filter((d) =>
      ["cleaning", "diagnosed"].includes(d.status)
    ).length ?? 0;
  const docsThisMonthCount =
    allDocsMeta?.filter(
      (d) => d.status !== "pending" && d.created_at >= startOfMonth
    ).length ?? 0;
  const thisMonthDocIds =
    allDocsMeta
      ?.filter((d) => d.created_at >= startOfMonth)
      .map((d) => d.id) ?? [];

  // ------------------------------------------------------------------
  // Compute metrics
  // ------------------------------------------------------------------

  // Metric 2: Issues resolved all time
  const issuesResolved =
    ((cleanupResult as { issues_resolved: number | null }[]) ?? []).reduce(
      (sum, c) => sum + (c.issues_resolved || 0),
      0
    ) ?? 0;

  // Metric 3: Avg score improvement
  type DiagnosesRow = {
    average_score_original: number;
    average_score_final: number | null;
    issues: unknown;
    document_id: string;
  };
  const diagnosesRows = (diagnosesResult as DiagnosesRow[]) ?? [];

  const completedDiagnoses = diagnosesRows.filter(
    (d) => d.average_score_final != null
  );
  const avgImprovement =
    completedDiagnoses.length > 0
      ? completedDiagnoses.reduce(
          (sum, d) =>
            sum + ((d.average_score_final ?? 0) - d.average_score_original),
          0
        ) / completedDiagnoses.length
      : null;

  // Metric 4: Most common issue category (all time)
  const allIssues = diagnosesRows.flatMap(
    (d) => (d.issues as DiagnosisIssue[]) ?? []
  );
  const categoryCounts: Record<string, number> = {};
  allIssues.forEach((issue) => {
    categoryCounts[issue.category] =
      (categoryCounts[issue.category] || 0) + 1;
  });
  const sortedCategories = Object.entries(categoryCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const mostCommonEntry = sortedCategories[0] ?? null;
  const totalIssueCount = allIssues.length;
  const mostCommonPct =
    mostCommonEntry && totalIssueCount > 0
      ? Math.round((mostCommonEntry[1] / totalIssueCount) * 100)
      : 0;

  // Top 5 issue categories this month (for bar chart widget)
  const thisMonthIssues = diagnosesRows
    .filter((d) => thisMonthDocIds.includes(d.document_id))
    .flatMap((d) => (d.issues as DiagnosisIssue[]) ?? []);
  const thisMonthCategoryCounts: Record<string, number> = {};
  thisMonthIssues.forEach((issue) => {
    thisMonthCategoryCounts[issue.category] =
      (thisMonthCategoryCounts[issue.category] || 0) + 1;
  });
  const topIssuesThisMonth = Object.entries(thisMonthCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxThisMonthCount = topIssuesThisMonth[0]?.[1] ?? 1;

  // Greeting is now handled client-side in DashboardHero
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  // Active brand context
  const activeBrand = (brandProfiles ?? []).find(p => p.is_default) || (brandProfiles ?? [])[0];
  const activeBrandName = activeBrand?.name ?? "Standard Brand";

  // Status line
  const statusLine =
    inProgressCount > 0
      ? `You have ${inProgressCount} document${inProgressCount === 1 ? "" : "s"} in progress.`
      : "No documents in progress. Ready to analyse something new?";

  // ------------------------------------------------------------------
  // Type-safe recent docs
  // ------------------------------------------------------------------
  type RecentDoc = {
    id: string;
    title: string | null;
    content_type: string;
    word_count: number | null;
    status: string;
    updated_at: string;
    diagnoses: Array<{
      average_score_original: number;
      average_score_final: number | null;
    }> | null;
    // PostgREST returns this as array regardless of FK direction
    brand_profiles: Array<{ name: string }> | { name: string } | null;
  };

  const recentDocs = (recentDocsRaw ?? []) as unknown as RecentDoc[];

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto no-scrollbar">
      {/* ---- Content Body ---- */}
      <div className="flex-1 px-6 lg:px-10 py-12 space-y-12 max-w-7xl mx-auto w-full">
        {/* ---- Hero / Status Header (Now Integrated) ---- */}
        <DashboardHero 
          userName={firstName}
          activeBrandName={activeBrandName}
          statusLine={statusLine}
        />
        
        {/* ---- Metric Grid ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Analysed */}
          <div className="group p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-secondary/20 text-secondary-foreground">
                <FileText size={20} />
              </div>
              <TrendingUp size={16} className="text-primary" />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Analysed</p>
            <h3 className="text-3xl font-bold text-foreground mt-1">{docsThisMonthCount}</h3>
            <p className="text-xs text-muted-foreground mt-2 font-medium">+1 this week</p>
          </div>

          {/* Resolved */}
          <div className="group p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <CircleCheck size={20} />
              </div>
            </div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Resolved</p>
            <h3 className="text-3xl font-bold text-foreground mt-1">{issuesResolved}</h3>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Lifetime impact</p>
          </div>

          {/* Improvement */}
          <div className="group p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-accent/10 text-accent">
                <ArrowUpRight size={20} />
              </div>
            </div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Improvement</p>
            <h3 className="text-3xl font-bold text-foreground mt-1">
              {avgImprovement != null ? `+${avgImprovement.toFixed(1)}` : "—"}
            </h3>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Avg. Quality Boost</p>
          </div>

          {/* Top Issue */}
          <div className="group p-6 rounded-3xl bg-primary text-primary-foreground shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-xl bg-primary-foreground/10">
                <CircleAlert size={20} />
              </div>
            </div>
            <p className="text-[11px] font-bold opacity-70 uppercase tracking-widest">Top Issue</p>
            <h3 className="text-lg font-bold leading-tight mt-1 line-clamp-1">
              {mostCommonEntry ? (CATEGORY_LABELS[mostCommonEntry[0]] || mostCommonEntry[0]) : "—"}
            </h3>
            <p className="text-xs opacity-70 mt-2 font-medium">
              {mostCommonEntry ? `${mostCommonPct}% of cases` : "Perfect scores"}
            </p>
          </div>
        </div>

        {/* ---- Recent Documents & Activity ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List (Documents) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold tracking-tight">Recent Content</h2>
              <Link href="/history" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View History <ChevronRight size={14} />
              </Link>
            </div>

            {recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-muted/20 border border-dashed border-border rounded-3xl">
                <p className="text-sm font-medium text-muted-foreground">Ready for your first analysis?</p>
                <Link href="/new" className="mt-4">
                  <UiButton variant="secondary" size="md">Get Started</UiButton>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((doc) => {
                  const diag = Array.isArray(doc.diagnoses) ? doc.diagnoses[0] : doc.diagnoses;
                  const score = diag?.average_score_final ?? diag?.average_score_original;
                  const href = getDocumentHref(doc.status, doc.id);
                  return (
                    <Link 
                      key={doc.id} 
                      href={href}
                      className="group flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/50 hover:bg-card hover:shadow-lg hover:border-primary/20 transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                        <FileText size={20} className="text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                          {doc.title || "Untitled Document"}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {CONTENT_TYPE_LABELS[doc.content_type] || doc.content_type}
                          </span>
                          <span className="text-[11px] text-border">•</span>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {formatRelativeTime(doc.updated_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
                            doc.status === 'exported' ? "bg-green-500/10 text-green-600" : "bg-primary/5 text-primary"
                          )}>
                            {getStatusLabel(doc.status)}
                          </span>
                          {score != null && (
                            <span className="text-sm font-bold text-foreground">
                              {score.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full" 
                              style={{ width: `${(score ?? 0) * 10}%` }} 
                            />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar Widgets (Issues & Brand) */}
          <div className="space-y-8">
            {/* Top Issues Widget */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight px-2">Top Issues</h2>
              <div className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-5">
                {topIssuesThisMonth.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">No issues detected recently.</p>
                ) : (
                  topIssuesThisMonth.map(([category, count]) => {
                    const priority = CATEGORY_PRIORITY[category] ?? "style";
                    const colorClass = priority === 'trust' ? 'bg-accent' : priority === 'substance' ? 'bg-secondary' : 'bg-green-400';
                    const pct = Math.max(10, Math.round((count / maxThisMonthCount) * 100));
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <span>{CATEGORY_LABELS[category] || category}</span>
                          <span className="text-foreground">{count}</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-1000", colorClass)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Brand Profiles Widget */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold tracking-tight">Brands</h2>
                <Link href="/settings/brand" className="text-xs font-bold text-primary hover:underline">Manage</Link>
              </div>
              <div className=" rounded-3xl border border-border bg-card overflow-hidden">
                {(brandProfiles ?? []).slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">{p.tone}</p>
                    </div>
                    {p.is_default && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
