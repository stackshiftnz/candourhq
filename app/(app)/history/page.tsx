"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getScoreBadgeClasses } from "@/lib/utils/score-colour";
import { formatRelativeTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const STATUS_CHIPS = [
  { label: "Exported", statuses: ["exported"] },
  {
    label: "In progress",
    statuses: ["cleaning", "cleaned", "submitted", "approved"],
  },
  { label: "Diagnosed", statuses: ["diagnosed"] },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "blog_post", label: "Blog post" },
  { value: "email", label: "Email" },
  { value: "report", label: "Report" },
  { value: "proposal", label: "Proposal" },
  { value: "press_release", label: "Press release" },
  { value: "social_post", label: "Social post" },
  { value: "memo", label: "Memo" },
];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog post",
  email: "Email",
  report: "Report",
  proposal: "Proposal",
  press_release: "Press release",
  social_post: "Social post",
  memo: "Memo",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrandProfile = { id: string; name: string };

type DocumentRow = {
  id: string;
  title: string | null;
  content_type: string;
  word_count: number | null;
  status: string;
  updated_at: string;
  brand_profile_id: string | null;
  brand_profiles: Array<{ name: string }> | { name: string } | null;
  diagnoses: Array<{
    average_score_original: number;
    average_score_final: number | null;
  }> | null;
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

function getStatusPill(status: string) {
  switch (status) {
    case "exported":
      return {
        label: "Exported",
        classes: "bg-green-100 text-green-800",
      };
    case "cleaning":
    case "cleaned":
    case "approved":
      return {
        label: "In progress",
        classes: "bg-blue-100 text-blue-800",
      };
    case "submitted":
      return {
        label: "Submitted",
        classes: "bg-purple-100 text-purple-800",
      };
    case "diagnosed":
      return {
        label: "Diagnosed",
        classes: "bg-amber-100 text-amber-800",
      };
    default:
      return {
        label: "Pending",
        classes: "bg-gray-100 text-gray-500",
      };
  }
}

function getBrandProfileName(
  bp: Array<{ name: string }> | { name: string } | null
): string | null {
  if (!bp) return null;
  if (Array.isArray(bp)) return bp[0]?.name ?? null;
  return (bp as { name: string }).name ?? null;
}

const ChevronRight = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-gray-300 flex-shrink-0"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-gray-400 flex-shrink-0"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const supabase = createClient();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contentType, setContentType] = useState("");
  const [profileId, setProfileId] = useState("");
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());

  // Data
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([]);

  // Derived
  const selectedStatuses = STATUS_CHIPS.filter((c) =>
    activeChips.has(c.label)
  ).flatMap((c) => c.statuses);
  const hasMore =
    totalCount !== null && totalCount > docs.length && docs.length > 0;
  const hasActiveFilters =
    !!debouncedSearch || !!contentType || !!profileId || activeChips.size > 0;

  // ------------------------------------------------------------------
  // Auth init
  // ------------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Fetch brand profiles for filter dropdown
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("brand_profiles")
      .select("id, name")
      .eq("user_id", userId)
      .then(({ data }) => setBrandProfiles(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ------------------------------------------------------------------
  // Debounce search input
  // ------------------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ------------------------------------------------------------------
  // Main fetch — re-runs when any filter changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    let q = supabase
      .from("documents")
      .select(
        "id, title, content_type, word_count, status, updated_at, brand_profile_id, brand_profiles(name), diagnoses(average_score_original, average_score_final)",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (debouncedSearch)
      q = q.ilike("title", `%${debouncedSearch}%`) as typeof q;
    if (contentType) q = q.eq("content_type", contentType) as typeof q;
    if (profileId) q = q.eq("brand_profile_id", profileId) as typeof q;
    if (selectedStatuses.length > 0)
      q = q.in("status", selectedStatuses) as typeof q;

    q.then(({ data, count }) => {
      setDocs((data ?? []) as unknown as DocumentRow[]);
      setTotalCount(count ?? 0);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, debouncedSearch, contentType, profileId, selectedStatuses.join(",")]);

  // ------------------------------------------------------------------
  // Load more
  // ------------------------------------------------------------------
  async function handleLoadMore() {
    if (loadingMore || !hasMore || !userId) return;
    setLoadingMore(true);

    const offset = docs.length;

    let q = supabase
      .from("documents")
      .select(
        "id, title, content_type, word_count, status, updated_at, brand_profile_id, brand_profiles(name), diagnoses(average_score_original, average_score_final)",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (debouncedSearch)
      q = q.ilike("title", `%${debouncedSearch}%`) as typeof q;
    if (contentType) q = q.eq("content_type", contentType) as typeof q;
    if (profileId) q = q.eq("brand_profile_id", profileId) as typeof q;
    if (selectedStatuses.length > 0)
      q = q.in("status", selectedStatuses) as typeof q;

    const { data, count } = await q;
    setDocs((prev) => [
      ...prev,
      ...((data ?? []) as unknown as DocumentRow[]),
    ]);
    setTotalCount(count ?? 0);
    setLoadingMore(false);
  }

  // ------------------------------------------------------------------
  // Chip toggle
  // ------------------------------------------------------------------
  function toggleChip(label: string) {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // ------------------------------------------------------------------
  // Clear all filters
  // ------------------------------------------------------------------
  function clearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setContentType("");
    setProfileId("");
    setActiveChips(new Set());
  }

  // ------------------------------------------------------------------
  // Render skeleton rows
  // ------------------------------------------------------------------
  const skeletonRows = Array.from({ length: 6 });

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      {/* ---- Topbar ---- */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 h-14 border-b border-gray-100 bg-white/95 backdrop-blur-sm flex-shrink-0">
        <h1 className="text-[15px] font-semibold text-gray-900">
          Document history
        </h1>
        <Link
          href="/new"
          className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          <span className="hidden sm:inline">New document</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* ---- Desktop filter bar ---- */}
      <div className="hidden lg:flex items-center gap-3 px-8 h-11 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        {/* Search */}
        <div className="relative flex items-center max-w-xs">
          <div className="absolute left-2.5 pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search documents..."
            className="h-7 pl-8 pr-3 text-sm border border-gray-200 rounded-md bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 w-64"
          />
        </div>

        {/* Content type */}
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="h-7 px-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
        >
          {CONTENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Brand profile */}
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className="h-7 px-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
        >
          <option value="">All profiles</option>
          {brandProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Status chips */}
        <div className="flex items-center gap-2">
          {STATUS_CHIPS.map((chip) => {
            const active = activeChips.has(chip.label);
            return (
              <button
                key={chip.label}
                onClick={() => toggleChip(chip.label)}
                className={[
                  "h-7 px-3 text-xs font-medium rounded-full transition-colors",
                  active
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 text-gray-500 hover:border-gray-400",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Mobile filter rows ---- */}
      <div className="lg:hidden border-b border-gray-100 bg-gray-50 flex-shrink-0">
        {/* Row 1: full-width search */}
        <div className="px-4 pt-2.5 pb-2">
          <div className="relative flex items-center">
            <div className="absolute left-3.5 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search documents..."
              className="h-11 w-full pl-10 pr-3 text-sm border border-gray-200 rounded-md bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            />
          </div>
        </div>

        {/* Row 2: scrollable type + profile chips */}
        <div className="flex overflow-x-auto gap-2 px-4 pb-2 no-scrollbar">
          {/* Content type chips */}
          {CONTENT_TYPE_OPTIONS.map((opt) => {
            const active = contentType === opt.value;
            return (
              <button
                key={`type-${opt.value}`}
                onClick={() => setContentType(opt.value)}
                className={[
                  "flex-shrink-0 h-11 px-4 text-xs font-medium rounded-full transition-colors whitespace-nowrap",
                  active
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 text-gray-500",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {opt.label}
              </button>
            );
          })}

          {/* Divider */}
          {brandProfiles.length > 0 && (
            <div className="flex-shrink-0 w-px bg-gray-200 my-1" />
          )}

          {/* Profile chips */}
          {brandProfiles.length > 0 && (
            <>
              <button
                onClick={() => setProfileId("")}
                className={[
                  "flex-shrink-0 h-11 px-4 text-xs font-medium rounded-full transition-colors whitespace-nowrap",
                  profileId === ""
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 text-gray-500",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                All profiles
              </button>
              {brandProfiles.map((p) => {
                const active = profileId === p.id;
                return (
                   <button
                    key={`profile-${p.id}`}
                    onClick={() => setProfileId(p.id)}
                    className={[
                      "flex-shrink-0 h-11 px-4 text-xs font-medium rounded-full transition-colors whitespace-nowrap",
                      active
                        ? "bg-gray-900 text-white"
                        : "border border-gray-200 text-gray-500",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {p.name}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Row 3: scrollable status chips */}
        <div className="flex overflow-x-auto gap-2 px-4 pb-2.5 no-scrollbar">
          {STATUS_CHIPS.map((chip) => {
            const active = activeChips.has(chip.label);
            return (
               <button
                key={chip.label}
                onClick={() => toggleChip(chip.label)}
                className={[
                  "flex-shrink-0 h-11 px-4 text-xs font-medium rounded-full transition-colors whitespace-nowrap",
                  active
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 text-gray-500",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Desktop column headers ---- */}
      <div className="hidden lg:flex items-center px-8 h-9 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">
            Document
          </span>
        </div>
        <div className="w-[100px] flex-shrink-0 text-right">
          <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">
            Score
          </span>
        </div>
        <div className="w-[90px] flex-shrink-0 text-center">
          <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">
            Status
          </span>
        </div>
        <div className="w-[90px] flex-shrink-0">
          <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">
            Profile
          </span>
        </div>
        <div className="w-[80px] flex-shrink-0 text-right">
          <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wider">
            Date
          </span>
        </div>
        <div className="w-[40px] flex-shrink-0" />
      </div>

      {/* ---- Document list ---- */}
      <div className="flex-1">
        {loading ? (
          // Skeleton
          <ul>
            {skeletonRows.map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-4 lg:px-8 py-3 border-b border-gray-100"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-48 animate-pulse" />
                  <div className="h-2.5 bg-gray-100 rounded w-32 animate-pulse" />
                </div>
                <div className="w-14 h-5 bg-gray-100 rounded-full animate-pulse" />
              </li>
            ))}
          </ul>
        ) : docs.length === 0 ? (
          // Empty states
          <div className="flex flex-col items-center justify-center py-24 px-4 gap-4">
            {hasActiveFilters ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-[17px] font-bold text-brand-dark">
                  No documents match your filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="text-[15px] font-semibold text-brand-dark underline decoration-gray-300 underline-offset-4 hover:decoration-brand-dark transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-5 px-8 border border-gray-100 rounded-3xl w-full max-w-sm mx-auto shadow-sm bg-white">
                <p className="text-[17px] font-bold text-brand-dark">No documents yet.</p>
                <Link href="/new">
                  <Button variant="brand" size="lg" className="h-12 px-6">
                    Analyse your first document
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <ul>
              {docs.map((doc, idx) => {
                const diagArr = Array.isArray(doc.diagnoses)
                  ? doc.diagnoses
                  : doc.diagnoses
                    ? [doc.diagnoses as unknown as { average_score_original: number; average_score_final: number | null }]
                    : [];
                const diag = diagArr[0] ?? null;
                const score =
                  diag?.average_score_final ?? diag?.average_score_original ?? null;
                const href = getDocumentHref(doc.status, doc.id);
                const typeLabel =
                  CONTENT_TYPE_LABELS[doc.content_type] ?? doc.content_type;
                const statusPill = getStatusPill(doc.status);
                const profileName = getBrandProfileName(doc.brand_profiles);
                const timeLabel = formatRelativeTime(doc.updated_at);

                return (
                  <li key={doc.id}>
                    <Link
                      href={href}
                      className={[
                        "flex items-center px-4 lg:px-8 py-4 cursor-pointer hover:bg-gray-50 transition-colors",
                        idx < docs.length - 1 ? "border-b border-gray-100" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {/* Col 1: Title + meta */}
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-[13px] font-medium text-gray-900 truncate">
                          {doc.title ?? "Untitled document"}
                        </p>
                        <p className="text-[12px] text-gray-400 mt-0.5 truncate">
                          {typeLabel}
                          {doc.word_count ? ` · ${doc.word_count} words` : ""}
                        </p>
                      </div>

                      {/* Col 2: Score pill */}
                      <div className="w-[100px] flex-shrink-0 hidden lg:flex justify-end pr-4">
                        {score != null ? (
                          <span
                            className={`rounded-full text-xs font-medium px-2 py-0.5 ${getScoreBadgeClasses(score)}`}
                          >
                            {score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="rounded-full text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-400">
                            —
                          </span>
                        )}
                      </div>

                      {/* Mobile score pill (visible only on mobile) */}
                      <div className="lg:hidden flex-shrink-0 mr-2">
                        {score != null ? (
                          <span
                            className={`rounded-full text-xs font-medium px-2 py-0.5 ${getScoreBadgeClasses(score)}`}
                          >
                            {score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="rounded-full text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-400">
                            —
                          </span>
                        )}
                      </div>

                      {/* Col 3: Status pill (desktop only) */}
                      <div className="w-[90px] flex-shrink-0 hidden lg:flex justify-center">
                        <span
                          className={`rounded-full text-[12px] font-medium px-2 py-0.5 ${statusPill.classes}`}
                        >
                          {statusPill.label}
                        </span>
                      </div>

                      {/* Col 4: Profile (desktop only) */}
                      <div className="w-[90px] flex-shrink-0 hidden lg:block">
                        <p className="text-[12px] text-gray-500 truncate">
                          {profileName ?? "—"}
                        </p>
                      </div>

                      {/* Col 5: Date (tablet+) */}
                      <div className="w-[80px] flex-shrink-0 hidden md:block text-right">
                        <p className="text-[12px] text-gray-400">{timeLabel}</p>
                      </div>

                      {/* Col 6: Chevron */}
                      <div className="w-[40px] flex-shrink-0 flex justify-end">
                        <ChevronRight />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Load more */}
            {hasMore && (
              <div className="px-4 lg:px-8 py-4">
                 <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full h-11 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom padding for mobile nav */}
      <div className="h-4 flex-shrink-0" />
    </div>
  );
}
