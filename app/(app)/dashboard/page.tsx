import { createClient } from "@/lib/supabase/server-user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatRelativeTime, getGreeting } from "@/lib/utils/format";
import { DiagnosisIssue } from "@/types/database";

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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const userId = user.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  // Use UTC hour — close enough for a greeting; avoids a client-side round-trip
  const hour = now.getUTCHours();

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

  // Greeting
  const greeting = getGreeting(hour);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

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
    <div className="flex flex-col h-full bg-white overflow-y-auto no-scrollbar">
      {/* ---- Yellow Header ---- */}
      <div className="bg-brand-yellow px-6 lg:px-10 pt-10 pb-12 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] lg:text-[40px] font-bold text-brand-dark tracking-tight leading-none mb-2">
            {greeting}, {firstName}.
          </h1>
          <p className="text-[15px] font-medium text-brand-dark/70">{statusLine}</p>
        </div>
        <Link
          href="/new"
          className="inline-flex items-center gap-2 h-11 px-5 text-[15px] font-bold bg-white text-brand-dark rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        >
          <span className="text-xl leading-none font-medium mb-0.5">+</span>
          <span>New document</span>
        </Link>
      </div>

      {/* ---- Page body ---- */}
      <div className="flex-1 px-4 lg:px-10 py-8 space-y-10 max-w-7xl">

        {/* ---- Metric cards ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1 — Documents analysed */}
          <div className="bg-brand-yellow rounded-[20px] p-5 lg:p-6 shadow-sm">
            <p className="text-[13px] font-semibold text-brand-dark/50 tracking-wide">
              Analysed
            </p>
            <p className="text-[32px] lg:text-[40px] font-bold text-brand-dark mt-2 leading-none">
              {docsThisMonthCount}
            </p>
            <p className="text-[13px] font-medium text-brand-dark/70 mt-1">+1 this week</p>
          </div>

          {/* 2 — Issues resolved */}
          <div className="bg-[#f8f6f0] rounded-[20px] p-5 lg:p-6 shadow-sm">
            <p className="text-[13px] font-semibold text-gray-400 tracking-wide">
              Resolved
            </p>
            <p className="text-[32px] lg:text-[40px] font-bold text-brand-dark mt-2 leading-none">
              {issuesResolved}
            </p>
            <p className="text-[13px] font-medium text-brand-green mt-1 tracking-tight">All time</p>
          </div>

          {/* 3 — Avg score improvement */}
          <div className="bg-[#f8f6f0] rounded-[20px] p-5 lg:p-6 shadow-sm">
            <p className="text-[13px] font-semibold text-gray-400 tracking-wide">
              Improvement
            </p>
            <p className="text-[32px] lg:text-[40px] font-bold text-brand-dark mt-2 leading-none">
              {avgImprovement != null
                ? `+${avgImprovement.toFixed(1)}`
                : "—"}
            </p>
            <p className="text-[13px] font-medium text-brand-pink mt-1 tracking-tight">Per document</p>
          </div>

          {/* 4 — Most common issue */}
          <div className="bg-[#fbfaf8] border border-gray-100 rounded-[20px] p-5 lg:p-6 shadow-sm">
            <p className="text-[13px] font-semibold text-gray-400 tracking-wide">
              Top issue
            </p>
            <p className="text-xl lg:text-2xl font-bold text-brand-dark mt-3 lg:mt-4 leading-tight truncate">
              {mostCommonEntry
                ? (CATEGORY_LABELS[mostCommonEntry[0]] ||
                  (mostCommonEntry[0].charAt(0).toUpperCase() + mostCommonEntry[0].slice(1)).replace(/_/g, " "))
                : "—"}
            </p>
            <p className="text-[13px] font-medium text-gray-400 mt-1 tracking-tight">
              {mostCommonEntry ? `${mostCommonPct}% of issues` : "No issues yet"}
            </p>
          </div>
        </div>

        {/* ---- Recent documents ---- */}
        <div>
          <div className="flex items-center justify-between px-2 mb-4">
            <h2 className="text-[18px] font-bold text-brand-dark">
              Recent documents
            </h2>
            <Link
              href="/history"
              className="text-[13px] font-semibold text-brand-dark underline decoration-gray-300 underline-offset-4 hover:decoration-brand-dark transition-colors p-2 -m-2"
            >
              View all
            </Link>
          </div>

          {recentDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 gap-4 bg-white border border-gray-100 rounded-[20px] shadow-sm">
              <p className="text-[17px] font-bold text-brand-dark">Nothing analysed yet.</p>
              <Link
                href="/new"
                className="inline-flex items-center gap-1.5 h-12 px-6 text-[15px] font-bold bg-brand-yellow text-brand-dark rounded-xl hover:bg-[#ffcd66] transition-colors shadow-sm"
              >
                Analyse your first document
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
              <ul>
                {recentDocs.map((doc, idx) => {
                  const diag = Array.isArray(doc.diagnoses)
                    ? doc.diagnoses[0]
                    : doc.diagnoses;
                  const score =
                    diag?.average_score_final ?? diag?.average_score_original;
                  const href = getDocumentHref(doc.status, doc.id);
                  const typeLabel =
                    CONTENT_TYPE_LABELS[doc.content_type] ?? doc.content_type;
                  const timeLabel = formatRelativeTime(doc.updated_at);
                  const showStatus = doc.status !== "exported";

                  return (
                    <li key={doc.id}>
                      <Link
                        href={href}
                        className={[
                          "flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors",
                          idx < recentDocs.length - 1
                            ? "border-b border-gray-100"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {/* Doc icon */}
                        <div className="w-10 h-10 bg-[#f8f6f0] rounded-full flex items-center justify-center flex-shrink-0 text-gray-500">
                          <DocIcon />
                        </div>

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                          <div className="md:col-span-2">
                            <p className="text-[14px] font-bold text-brand-dark truncate leading-tight">
                              {doc.title ?? "Untitled document"}
                            </p>
                            <p className="text-[12px] font-medium text-gray-400 mt-0.5 truncate">
                              {typeLabel}
                            </p>
                          </div>
                          <div className="hidden md:block col-span-1">
                            <p className="text-[13px] font-medium text-gray-500">{timeLabel}</p>
                          </div>
                          <div className="hidden md:flex justify-end col-span-1 items-center gap-4">
                             {showStatus && (
                                <span className="text-[13px] font-bold text-gray-500">
                                  {getStatusLabel(doc.status)}
                                </span>
                             )}
                            {score != null ? (
                               <span className="text-[14px] font-bold text-brand-dark">
                                 {score.toFixed(1)}
                               </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Mobile right side elements */}
                        <div className="flex md:hidden flex-col items-end gap-1 flex-shrink-0">
                           {score != null && (
                             <span className="text-[14px] font-bold text-brand-dark">
                               {score.toFixed(1)}
                             </span>
                           )}
                           <span className="text-[12px] font-semibold text-gray-400 rounded bg-gray-100 px-1.5 py-0.5">
                             {getStatusLabel(doc.status)}
                           </span>
                        </div>
                        
                        {/* Action buttons (View/Pay style) */}
                        <div className="ml-4 flex-shrink-0 hidden sm:block">
                           <div className="h-11 px-5 flex items-center rounded-xl text-[13px] font-bold border border-gray-200 bg-white text-brand-dark hover:bg-gray-50 transition-colors shadow-sm">
                             View
                           </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* ---- Two-column widget row ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Top issues this month */}
          <div>
            <h2 className="text-[18px] font-bold text-brand-dark mb-4 px-2">Top issues</h2>
            <div className="border border-gray-100 rounded-[20px] overflow-hidden bg-white shadow-sm p-6 flex flex-col items-center justify-center min-h-[260px] space-y-6">
              {topIssuesThisMonth.length === 0 ? (
                <p className="text-[12px] font-medium text-gray-400 text-center">
                  No issues recorded yet. Analyse a document to see your patterns.
                </p>
              ) : (
                topIssuesThisMonth.map(([category, count]) => {
                  const priority = CATEGORY_PRIORITY[category] ?? "style";
                  const barColour = priority === 'trust' ? 'bg-brand-pink' : priority === 'substance' ? 'bg-brand-yellow' : 'bg-brand-green';
                  const pct = Math.max(
                    4,
                    Math.round((count / maxThisMonthCount) * 100)
                  );
                  return (
                    <div
                      key={category}
                      className="flex items-center gap-4 w-full"
                    >
                      <p className="text-[13px] font-bold text-brand-dark w-[120px] flex-shrink-0 truncate">
                        {CATEGORY_LABELS[category] ||
                          (category.charAt(0).toUpperCase() + category.slice(1)).replace(/_/g, " ")}
                      </p>
                      <div className="flex-1 h-[22px] bg-[#f8f6f0] rounded-full overflow-hidden flex items-center pr-1">
                        <div
                          className={`h-full rounded-full ${barColour} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[14px] font-bold text-brand-dark w-8 text-right flex-shrink-0">
                        {count}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right — Brand profiles */}
          <div>
            <h2 className="text-[18px] font-bold text-brand-dark mb-4 px-2">Brand profiles</h2>
            <div className="border border-gray-100 rounded-[20px] overflow-hidden bg-white shadow-sm">
              <ul>
                {(brandProfiles ?? []).map((profile, idx) => (
                  <li
                    key={profile.id}
                    className={[
                      "flex items-center justify-between px-6 py-5",
                      idx < (brandProfiles ?? []).length - 1
                        ? "border-b border-gray-100"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[15px] font-bold text-brand-dark truncate leading-tight">
                          {profile.name}
                        </p>
                        {profile.is_default && (
                          <span className="text-[12px] font-bold text-brand-dark bg-brand-yellow rounded shadow-sm px-2 py-0.5 flex-shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-medium text-gray-500">
                        {profile.language_variant === "en-GB"
                          ? "British English"
                          : "US English"}{" "}
                        · {profile.tone}
                      </p>
                    </div>
                    <Link
                      href={`/settings/brand/${profile.id}`}
                      className="h-11 px-4 flex items-center rounded-xl text-[13px] font-bold border border-gray-200 bg-white text-brand-dark hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0 ml-4"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="px-6 py-4 border-t border-gray-100 bg-[#fbfaf8]">
                <Link
                  href="/settings/brand"
                  className="text-[14px] font-bold text-brand-dark hover:text-brand-dark/70 transition-colors flex items-center gap-2"
                >
                  <span className="w-5 h-5 rounded-full bg-brand-dark text-white flex items-center justify-center text-lg leading-none pb-0.5">+</span>
                  New profile
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom padding for mobile nav */}
        <div className="h-4" />
      </div>
    </div>
  );
}
