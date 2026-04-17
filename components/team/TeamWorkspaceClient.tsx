"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  inviteTeamMember,
  cancelInvite,
  removeMember,
  approveDocument,
  requestChanges,
  updateWorkspaceSettings,
} from "@/app/actions/team";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamMemberWithProfile {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile: {
    full_name: string | null;
    email: string | null;
  };
}

export interface PendingInvitation {
  id: string;
  workspace_id: string;
  invited_email: string;
  role: string;
  status: string;
  created_at: string;
}

export interface SubmittedDocument {
  id: string;
  title: string | null;
  submitted_for_approval_at: string | null;
  submitted_by_name: string | null;
  average_score_final: number | null;
  average_score_original: number;
}

export interface WorkspaceData {
  id: string;
  name: string;
  owner_id: string;
  require_approval_before_export: boolean;
  minimum_score_to_export: boolean;
  minimum_score_threshold: number;
  notify_on_submission: boolean;
}

interface NavProfile {
  id: string;
  name: string;
  is_default: boolean;
}

interface Props {
  currentUserId: string;
  currentUserRole: string;
  workspace: WorkspaceData;
  members: TeamMemberWithProfile[];
  pendingInvitations: PendingInvitation[];
  submittedDocuments: SubmittedDocument[];
  allBrandProfiles: NavProfile[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTES = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
];

function getAvatarColors(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function rolePillClass(role: string): string {
  if (role === "admin") return "bg-blue-100 text-blue-700";
  if (role === "editor") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-500 border border-gray-200";
}

function scorePillClass(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-700";
  if (score >= 4) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-gray-400">
      {children}
    </p>
  );
}

function SectionDivider() {
  return <div className="border-t border-gray-100" />;
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-11 w-14 items-center justify-center cursor-pointer transition-colors duration-200 focus:outline-none",
      ].join(" ")}
    >
      <div
        className={[
          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          checked ? "bg-gray-900" : "bg-gray-200",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </div>
    </button>
  );
}

const NAV_ACCOUNT_LINKS = [
  { label: "Plan and billing", href: "/settings/billing" },
  { label: "Team members", href: "/settings/team", active: true },
  { label: "Notifications", href: "/settings/notifications" },
];

// ── Main component ────────────────────────────────────────────────────────────

export function TeamWorkspaceClient({
  currentUserId,
  currentUserRole,
  workspace: initialWorkspace,
  members: initialMembers,
  pendingInvitations: initialInvitations,
  submittedDocuments: initialSubmitted,
  allBrandProfiles,
}: Props) {
  const isAdmin = currentUserRole === "admin";

  // ── Workspace settings state ──
  const [workspace, setWorkspace] = useState(initialWorkspace);

  // ── Members & invitations state ──
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [submittedDocs, setSubmittedDocs] = useState(initialSubmitted);

  // ── Invite form state ──
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // ── Approval queue state ──
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState<Record<string, string>>({});
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  // ── Toast ──
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Invite handler ────────────────────────────────────────────────────────

  async function handleSendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("error", "Please enter a valid email address.");
      return;
    }
    setIsSendingInvite(true);
    const result = await inviteTeamMember(workspace.id, email, inviteRole);
    setIsSendingInvite(false);

    if (result.duplicate) {
      showToast("error", "This person has already been invited or is already a member.");
      return;
    }
    if (!result.success) {
      showToast("error", result.error ?? "Failed to send invite.");
      return;
    }

    // Optimistically add to pending list
    setInvitations((prev) => [
      ...prev,
      {
        id: `optimistic-${Date.now()}`,
        workspace_id: workspace.id,
        invited_email: email,
        role: inviteRole,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);
    setInviteEmail("");
    showToast("success", `Invite sent to ${email}.`);
  }

  // ── Cancel invite ─────────────────────────────────────────────────────────

  async function handleCancelInvite(inviteId: string) {
    if (inviteId.startsWith("optimistic-")) {
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId));
      return;
    }
    const result = await cancelInvite(inviteId);
    if (result.success) {
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId));
    } else {
      showToast("error", result.error ?? "Failed to cancel invite.");
    }
  }

  // ── Remove member ─────────────────────────────────────────────────────────

  async function handleRemoveMember(memberId: string) {
    const result = await removeMember(memberId);
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } else {
      showToast("error", result.error ?? "Failed to remove member.");
    }
  }

  // ── Approve document ──────────────────────────────────────────────────────

  async function handleApprove(docId: string) {
    setApprovingId(docId);
    const result = await approveDocument(docId);
    setApprovingId(null);

    if (result.success) {
      setFadingIds((prev) => new Set(Array.from(prev).concat(docId)));
      setTimeout(() => {
        setSubmittedDocs((prev) => prev.filter((d) => d.id !== docId));
        setFadingIds((prev) => {
          const next = new Set(Array.from(prev));
          next.delete(docId);
          return next;
        });
      }, 400);
      showToast("success", "Document approved.");
    } else {
      showToast("error", result.error ?? "Failed to approve document.");
    }
  }

  // ── Request changes ───────────────────────────────────────────────────────

  async function handleRequestChanges(docId: string) {
    const note = changeNote[docId] ?? "";
    const result = await requestChanges(docId, note);

    if (result.success) {
      setFadingIds((prev) => new Set(Array.from(prev).concat(docId)));
      setTimeout(() => {
        setSubmittedDocs((prev) => prev.filter((d) => d.id !== docId));
        setFadingIds((prev) => {
          const next = new Set(Array.from(prev));
          next.delete(docId);
          return next;
        });
      }, 400);
      showToast("success", "Feedback sent.");
      setRequestingId(null);
      setChangeNote((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    } else {
      showToast("error", result.error ?? "Failed to send feedback.");
    }
  }

  // ── Workspace toggle save ─────────────────────────────────────────────────

  async function handleToggle(
    field: keyof Pick<
      WorkspaceData,
      | "require_approval_before_export"
      | "minimum_score_to_export"
      | "notify_on_submission"
    >,
    value: boolean
  ) {
    const prev = workspace[field];
    setWorkspace((ws) => ({ ...ws, [field]: value }));
    const result = await updateWorkspaceSettings(workspace.id, {
      [field]: value,
    });
    if (!result.success) {
      setWorkspace((ws) => ({ ...ws, [field]: prev }));
      showToast("error", "Failed to save setting.");
    }
  }

  async function handleThresholdChange(value: number) {
    const prev = workspace.minimum_score_threshold;
    setWorkspace((ws) => ({ ...ws, minimum_score_threshold: value }));
    const result = await updateWorkspaceSettings(workspace.id, {
      minimum_score_threshold: value,
    });
    if (!result.success) {
      setWorkspace((ws) => ({ ...ws, minimum_score_threshold: prev }));
      showToast("error", "Failed to save threshold.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-white">
      {/* ===== LEFT NAV — desktop ===== */}
      <aside className="hidden lg:flex flex-col w-[180px] flex-shrink-0 border-r border-gray-100 bg-gray-50 py-4 overflow-y-auto">
        {allBrandProfiles.length > 0 && (
          <>
            <div className="px-4 mb-2">
              <SectionLabel>Brand profiles</SectionLabel>
            </div>
            <nav className="mb-4">
              {allBrandProfiles.map((p) => (
                <Link
                  key={p.id}
                  href={`/settings/brand/${p.id}`}
                  className="flex items-center px-4 py-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </nav>
          </>
        )}
        <div className="px-4 mb-2 mt-2">
          <SectionLabel>Account</SectionLabel>
        </div>
        <nav>
          {NAV_ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "flex items-center px-4 py-2 text-[13px] transition-colors",
                link.active
                  ? "font-medium text-gray-900 bg-white border-r-2 border-gray-900"
                  : "text-gray-400 hover:text-gray-600",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ===== MOBILE NAV — horizontal pill row ===== */}
      <div className="lg:hidden flex-shrink-0 border-b border-gray-100 bg-gray-50">
        <div className="flex overflow-x-auto gap-2 px-4 py-2.5 no-scrollbar">
          {NAV_ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "flex-shrink-0 h-11 px-4 text-xs font-medium rounded-full transition-colors flex items-center justify-center whitespace-nowrap",
                link.active
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 text-gray-500 hover:bg-gray-50",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-6 lg:px-8 py-8 space-y-8 pb-24 lg:pb-12">
          {/* Heading */}
          <div>
            <h1 className="text-[17px] font-medium text-gray-900">
              Team members
            </h1>
            <p className="text-[12px] text-gray-400 mt-1">
              Admins can manage members and approve documents. Editors can
              analyse, clean, and submit. Viewers can read and export.
            </p>
          </div>

          <SectionDivider />

          {/* ── Invite a member ── */}
          {isAdmin && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-medium text-gray-900">
                Invite a member
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendInvite();
                    }
                  }}
                  placeholder="name@company.com"
                  className="flex-1 h-11 px-3 text-sm border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-11 px-3 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 bg-white"
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  variant="primary"
                  size="md"
                  className="h-11"
                  onClick={handleSendInvite}
                  loading={isSendingInvite}
                  disabled={!inviteEmail.trim()}
                >
                  Send invite
                </Button>
              </div>
            </section>
          )}

          {isAdmin && <SectionDivider />}

          {/* ── Team members list ── */}
          <section className="space-y-3">
            <h3 className="text-[13px] font-medium text-gray-900">
              Team ({members.length}{" "}
              {members.length === 1 ? "member" : "members"})
            </h3>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {members.map((member, idx) => {
                const displayName =
                  member.profile.full_name ||
                  member.profile.email ||
                  "Unknown";
                const avatarColors = getAvatarColors(displayName);
                const initials = getInitials(
                  member.profile.full_name,
                  member.profile.email
                );
                const isCurrentUser = member.user_id === currentUserId;

                return (
                  <div
                    key={member.id}
                    className={[
                      "flex items-center gap-3 p-3",
                      idx < members.length - 1
                        ? "border-b border-gray-100"
                        : "",
                    ].join(" ")}
                  >
                    {/* Avatar */}
                    <div
                      className={[
                        "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0",
                        avatarColors,
                      ].join(" ")}
                    >
                      {initials}
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 truncate">
                        {member.profile.full_name || member.profile.email || "Unknown"}
                      </p>
                      {member.profile.full_name && (
                        <p className="text-[12px] text-gray-400 truncate">
                          {member.profile.email}
                        </p>
                      )}
                    </div>

                    {/* Role pill */}
                    <span
                      className={[
                        "flex-shrink-0 text-[12px] font-medium px-2 py-0.5 rounded-full capitalize",
                        rolePillClass(member.role),
                      ].join(" ")}
                    >
                      {member.role}
                    </span>

                    {/* Action */}
                    {isCurrentUser ? (
                      <span className="text-[12px] text-gray-400 w-14 text-right">
                        You
                      </span>
                    ) : isAdmin ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[12px] text-gray-400 hover:text-red-600 w-14"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <span className="w-14" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div className="mt-2 space-y-2">
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 px-3 py-2 border border-dashed border-gray-200 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[12px] text-gray-400">?</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-600 truncate">
                        {invite.invited_email}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[12px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                      Pending
                    </span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[12px] text-gray-400 hover:text-red-600 whitespace-nowrap"
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        Cancel invite
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Approval queue — admins only ── */}
          {isAdmin && (
            <>
              <SectionDivider />
              <section className="space-y-3">
                <h3 className="text-[13px] font-medium text-gray-900">
                  Approval queue ({submittedDocs.length} awaiting)
                </h3>

                {submittedDocs.length === 0 ? (
                  <p className="text-[13px] text-gray-400 text-center py-6">
                    No documents awaiting approval.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {submittedDocs.map((doc) => {
                      const score =
                        doc.average_score_final ?? doc.average_score_original;
                      const isFading = fadingIds.has(doc.id);
                      const isRequesting = requestingId === doc.id;

                      return (
                        <div
                          key={doc.id}
                          className={[
                            "border border-gray-100 rounded-xl p-4 transition-opacity duration-400",
                            isFading ? "opacity-0" : "opacity-100",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-gray-900 truncate">
                                {doc.title || "Untitled Document"}
                              </p>
                              <p className="text-[12px] text-gray-400 mt-0.5">
                                Submitted
                                {doc.submitted_by_name
                                  ? ` by ${doc.submitted_by_name}`
                                  : ""}{" "}
                                ·{" "}
                                {formatRelativeTime(
                                  doc.submitted_for_approval_at
                                )}{" "}
                                · {score.toFixed(1)}/10
                              </p>
                            </div>
                            <span
                              className={[
                                "flex-shrink-0 text-[12px] font-bold px-2 py-0.5 rounded-full",
                                scorePillClass(score),
                              ].join(" ")}
                            >
                              {score.toFixed(1)}
                            </span>
                          </div>

                          {isRequesting ? (
                            <div className="space-y-2">
                              <textarea
                                value={changeNote[doc.id] ?? ""}
                                onChange={(e) =>
                                  setChangeNote((prev) => ({
                                    ...prev,
                                    [doc.id]: e.target.value,
                                  }))
                                }
                                placeholder="Add a note for the editor…"
                                rows={3}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 resize-none"
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() =>
                                    handleRequestChanges(doc.id)
                                  }
                                >
                                  Send feedback
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRequestingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                loading={approvingId === doc.id}
                                onClick={() => handleApprove(doc.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setRequestingId(doc.id)}
                              >
                                Request changes
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ── Workflow settings ── */}
          {isAdmin && (
            <>
              <SectionDivider />
              <section className="space-y-0">
                <h3 className="text-[13px] font-medium text-gray-900 mb-3">
                  Workflow settings
                </h3>

                {/* Toggle 1: Require approval before export */}
                <div className="flex items-start justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-[13px] font-medium text-gray-900">
                      Require approval before export
                    </p>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      Editors submit documents for admin review before they can
                      export.
                    </p>
                  </div>
                  <Toggle
                    checked={workspace.require_approval_before_export}
                    onChange={(val) =>
                      handleToggle("require_approval_before_export", val)
                    }
                  />
                </div>

                {/* Toggle 2: Minimum score to export */}
                <div className="flex items-start justify-between py-3 border-b border-gray-100">
                  <div className="flex-1 pr-4">
                    <p className="text-[13px] font-medium text-gray-900">
                      Minimum score to export
                    </p>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      Block exports below a quality threshold.
                    </p>
                    {workspace.minimum_score_to_export && (
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-[12px] text-gray-600">
                          Minimum score:
                        </label>
                        <input
                          type="number"
                          value={workspace.minimum_score_threshold}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 1.0 && val <= 10.0) {
                              handleThresholdChange(
                                Math.round(val * 2) / 2
                              );
                            }
                          }}
                          min={1.0}
                          max={10.0}
                          step={0.5}
                          className="w-20 h-11 px-2 text-sm border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
                        />
                      </div>
                    )}
                  </div>
                  <Toggle
                    checked={workspace.minimum_score_to_export}
                    onChange={(val) =>
                      handleToggle("minimum_score_to_export", val)
                    }
                  />
                </div>

                {/* Toggle 3: Notify on submission */}
                <div className="flex items-start justify-between py-3">
                  <div>
                    <p className="text-[13px] font-medium text-gray-900">
                      Notify on document submission
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Admins receive an email when a member submits for
                      approval.
                    </p>
                  </div>
                  <Toggle
                    checked={workspace.notify_on_submission}
                    onChange={(val) =>
                      handleToggle("notify_on_submission", val)
                    }
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={[
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
            toast.type === "success"
              ? "bg-gray-900 text-white"
              : "bg-red-600 text-white",
          ].join(" ")}
        >
          {toast.type === "success" ? "✓" : "✗"} {toast.message}
        </div>
      )}
    </div>
  );
}
