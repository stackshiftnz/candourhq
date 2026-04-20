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
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  Trash2, 
  History, 
  CheckCircle2, 
  MessageSquare, 
  ChevronRight, 
  Settings2, 
  Bell, 
  CreditCard,
  ArrowLeft,
  ShieldAlert,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  "bg-primary/10 text-primary border-primary/20",
  "bg-accent/10 text-accent border-accent/20",
  "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "bg-green-500/10 text-green-500 border-green-500/20",
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
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function rolePillClass(role: string): string {
  if (role === "admin") return "bg-primary/10 text-primary border-primary/20";
  if (role === "editor") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  return "bg-muted text-muted-foreground/60 border-border";
}

function scorePillClass(score: number): string {
  if (score >= 7) return "bg-green-500/10 text-green-500 border-green-500/20";
  if (score >= 4) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-accent/10 text-accent border-accent/20";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-2">
      {children}
    </p>
  );
}

function SectionDivider() {
  return <div className="border-t border-border/50" />;
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
      className="relative inline-flex h-8 w-14 items-center cursor-pointer group focus:outline-none transition-all"
    >
      <div
        className={cn(
          "h-6 w-11 rounded-full border-2 border-transparent transition-all duration-300",
          checked ? "bg-foreground" : "bg-muted"
        )}
      >
        <div
          className={cn(
            "h-4 w-4 transform rounded-full bg-background shadow-xl transition-all duration-300 flex items-center justify-center",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        >
           {checked && <div className="w-1 h-1 rounded-full bg-foreground" />}
        </div>
      </div>
    </button>
  );
}

const NAV_ACCOUNT_LINKS = [
  { label: "Plan and billing", href: "/settings/billing", icon: <CreditCard size={14} /> },
  { label: "Team members", href: "/settings/team", icon: <Users size={14} />, active: true },
  { label: "Notifications", href: "/settings/notifications", icon: <Bell size={14} /> },
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

  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [submittedDocs, setSubmittedDocs] = useState(initialSubmitted);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState<Record<string, string>>({});
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

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

  async function handleRemoveMember(memberId: string) {
    const result = await removeMember(memberId);
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } else {
      showToast("error", result.error ?? "Failed to remove member.");
    }
  }

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
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background selection:bg-primary/20">
      {/* ===== LEFT NAV — desktop ===== */}
      <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 border-r border-border bg-muted/20 py-8 overflow-y-auto custom-scrollbar">
        {allBrandProfiles.length > 0 && (
          <>
            <div className="px-6 mb-4">
              <SectionLabel>Identity Matrices</SectionLabel>
            </div>
            <nav className="mb-8 px-3 space-y-1">
              {allBrandProfiles.map((p) => (
                <Link
                  key={p.id}
                  href={`/settings/brand/${p.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-bold text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all rounded-xl group"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/20 group-hover:bg-primary transition-all" />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </nav>
          </>
        )}
        <div className="px-6 mb-4 mt-4">
          <SectionLabel>Nexus Nodes</SectionLabel>
        </div>
        <nav className="px-3 space-y-1">
          {NAV_ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-[12px] font-bold transition-all duration-300 rounded-xl",
                link.active
                   ? "text-foreground bg-background border border-border shadow-xl shadow-black/5"
                   : "text-muted-foreground/40 hover:text-foreground hover:bg-muted"
              )}
            >
              <div className="w-2 opacity-50">{link.icon}</div>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* ===== MOBILE NAV — horizontal pill row ===== */}
      <div className="lg:hidden flex-shrink-0 border-b border-border bg-muted/40 backdrop-blur-xl">
        <div className="flex overflow-x-auto gap-3 px-4 py-4 no-scrollbar">
          {NAV_ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex-shrink-0 h-10 px-5 text-[10px] font-bold rounded-2xl transition-all flex items-center justify-center whitespace-nowrap border",
                link.active
                  ? "bg-foreground text-background border-foreground shadow-lg shadow-black/10"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[800px] px-8 lg:px-12 py-10 space-y-12 pb-32 lg:pb-12">
          {/* Heading */}
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <Link href="/settings/team" className="lg:hidden p-2 rounded-full border border-border bg-background">
                    <ArrowLeft size={16} />
                 </Link>
                 <h1 className="text-3xl font-bold text-foreground tracking-tight">Collaboration Hub</h1>
              </div>
              <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed max-w-lg">
                Manage your collective intelligence nodes. Admins oversee matrix calibration and high-level verification. Editors process document vectors.
              </p>
            </div>
          </div>

          <SectionDivider />

          {/* ── Invite a member ── */}
          {isAdmin && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <UserPlus size={14} />
                 </div>
                 <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Deploy Pulse</h3>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-[2]">
                   <Input
                     type="email"
                     value={inviteEmail}
                     onChange={(e) => setInviteEmail(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === "Enter") {
                         e.preventDefault();
                         handleSendInvite();
                       }
                     }}
                     placeholder="identity@nexus.sh"
                     className="h-14 px-6 text-sm font-bold rounded-[22px] bg-muted/20 border-border/50 focus:bg-background transition-all pr-12"
                   />
                   <Mail size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
                </div>
                
                <div className="relative flex-1">
                   <select
                     value={inviteRole}
                     onChange={(e) => setInviteRole(e.target.value)}
                     className="w-full h-14 pl-6 pr-10 text-[10px] font-bold uppercase tracking-widest border border-border/50 rounded-[22px] bg-muted/20 text-foreground focus:outline-none appearance-none hover:bg-muted/40 transition-all"
                   >
                     <option value="editor">Editor</option>
                     <option value="admin">Admin</option>
                     <option value="viewer">Viewer</option>
                   </select>
                   <ChevronRight size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none rotate-90" />
                </div>

                <Button
                  className="h-14 px-8 rounded-[22px] font-bold uppercase tracking-widest text-[10px] bg-foreground text-background hover:scale-[1.02] transition-all shadow-xl shadow-black/10 shrink-0"
                  onClick={handleSendInvite}
                  loading={isSendingInvite}
                  disabled={!inviteEmail.trim()}
                >
                  <Plus size={14} className="mr-2" strokeWidth={3} />
                  Authorize
                </Button>
              </div>
            </section>
          )}

          {isAdmin && <SectionDivider />}

          {/* ── Team members list ── */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                     <Users size={14} />
                  </div>
                  <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Active Nodes</h3>
               </div>
               <Badge variant="secondary" size="sm" className="opacity-40">{members.length} Authorized</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {members.map((member) => {
                const displayName = member.profile.full_name || member.profile.email || "Unknown";
                const initials = getInitials(member.profile.full_name, member.profile.email);
                const avatarStyles = getAvatarColors(displayName);
                const isCurrentUser = member.user_id === currentUserId;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-5 p-6 bg-card border border-border rounded-[32px] hover:border-primary/30 transition-all group"
                  >
                    {/* Avatar */}
                    <div className={cn(
                       "w-14 h-14 rounded-[22px] flex items-center justify-center text-sm font-bold border-2 transition-transform duration-500 group-hover:rotate-6 shrink-0",
                       avatarStyles
                    )}>
                       {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-foreground truncate">
                             {member.profile.full_name || member.profile.email || "Unknown Identity"}
                          </span>
                          {isCurrentUser && (
                             <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[8px] font-bold tracking-widest text-primary uppercase">
                                Root
                             </div>
                          )}
                       </div>
                       <p className="text-[11px] font-medium text-muted-foreground/40 truncate">
                          {member.profile.email}
                       </p>
                    </div>

                    <div className={cn(
                       "flex-shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border",
                       rolePillClass(member.role)
                    )}>
                       {member.role}
                    </div>

                    <div className="w-14 flex justify-end">
                       {isCurrentUser ? (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                             <ShieldCheck size={14} />
                          </div>
                       ) : isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground/30 hover:text-accent hover:bg-accent/10 rounded-xl"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                             <Trash2 size={16} />
                          </Button>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div className="space-y-3 pt-2">
                <SectionLabel>Authorized Pending Transmissions</SectionLabel>
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-5 p-6 bg-muted/10 border border-dashed border-border rounded-[32px] group"
                  >
                    <div className="w-14 h-14 rounded-[22px] bg-background border border-dashed border-border flex items-center justify-center text-muted-foreground/20 shrink-0">
                       <Mail size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <span className="text-sm font-bold text-muted-foreground truncate block mb-0.5">
                          {invite.invited_email}
                       </span>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                          Synchronization Awaiting...
                       </p>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-muted bg-muted/40 text-muted-foreground/60">
                       {invite.role}
                    </div>
                    {isAdmin && (
                       <Button
                         variant="ghost"
                         size="sm"
                         className="text-muted-foreground/30 hover:text-accent hover:bg-accent/10 rounded-xl whitespace-nowrap"
                         onClick={() => handleCancelInvite(invite.id)}
                       >
                          <Trash2 size={16} />
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
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                         <ShieldAlert size={14} />
                      </div>
                      <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Verification Queue</h3>
                   </div>
                   <Badge variant="accent" size="sm" className="bg-accent/20 text-accent border-accent/30">{submittedDocs.length} Vectors</Badge>
                </div>

                {submittedDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed border-border rounded-[48px] bg-muted/5">
                     <CheckCircle2 size={32} className="text-green-500/20 mb-4" />
                     <p className="text-[11px] font-bold uppercase text-center text-muted-foreground tracking-widest">Registry Clear · No pending audits</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {submittedDocs.map((doc) => {
                      const score = doc.average_score_final ?? doc.average_score_original;
                      const isFading = fadingIds.has(doc.id);
                      const isRequesting = requestingId === doc.id;

                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "bg-card border border-border rounded-[40px] p-8 transition-all duration-500",
                            isFading ? "opacity-0 scale-95 translate-y-4" : "opacity-100"
                          )}
                        >
                          <div className="flex items-start justify-between gap-6 mb-8">
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-3 mb-2">
                                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Audit Required</span>
                               </div>
                               <h4 className="text-xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors truncate">
                                 {doc.title || "Untitled Vector"}
                               </h4>
                               <div className="flex items-center gap-3 mt-3">
                                  <p className="text-[11px] font-medium text-muted-foreground/60">
                                    Author: <span className="text-foreground font-bold">{doc.submitted_by_name || "Nexus Node"}</span>
                                  </p>
                                  <span className="text-muted-foreground/20 text-[8px]">|</span>
                                  <p className="text-[11px] font-medium text-muted-foreground/60 flex items-center gap-1.5">
                                    <History size={10} strokeWidth={3} />
                                    {formatRelativeTime(doc.submitted_for_approval_at)}
                                  </p>
                               </div>
                            </div>
                            
                            <div className={cn(
                               "w-20 h-20 rounded-[32px] flex flex-col items-center justify-center border-2 transition-all group-hover:scale-105",
                               scorePillClass(score)
                            )}>
                               <span className="text-lg font-bold">{score.toFixed(1)}</span>
                               <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Score</span>
                            </div>
                          </div>

                          {isRequesting ? (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                              <textarea
                                value={changeNote[doc.id] ?? ""}
                                onChange={(e) =>
                                  setChangeNote((prev) => ({
                                    ...prev,
                                    [doc.id]: e.target.value,
                                  }))
                                }
                                placeholder="Specify modification requirements..."
                                rows={4}
                                className="w-full p-6 text-sm font-medium bg-muted/20 border border-border rounded-[28px] placeholder-muted-foreground/30 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/50 transition-all resize-none custom-scrollbar"
                              />
                              <div className="flex gap-3">
                                <Button
                                  className="h-12 px-8 rounded-full font-bold text-[10px] bg-accent text-white shadow-lg shadow-accent/20"
                                  onClick={() => handleRequestChanges(doc.id)}
                                >
                                  Transmit Feedback
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="h-12 px-8 rounded-full font-bold text-[10px] text-muted-foreground/60"
                                  onClick={() => setRequestingId(null)}
                                >
                                  Abort
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <Button
                                className="h-14 px-10 rounded-[28px] font-bold uppercase tracking-widest text-xs bg-foreground text-background hover:scale-[1.02] transition-all shadow-xl shadow-black/20 group"
                                loading={approvingId === doc.id}
                                onClick={() => handleApprove(doc.id)}
                              >
                                <CheckCircle2 size={16} className="mr-2" strokeWidth={3} />
                                Verify Vector
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-14 px-8 rounded-[28px] font-bold text-[10px] bg-muted/50 border-border/50 text-foreground hover:bg-accent/10 hover:text-accent hover:border-accent/20 transition-all"
                                onClick={() => setRequestingId(doc.id)}
                              >
                                <MessageSquare size={14} className="mr-2" />
                                Modify Set
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
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/40">
                      <Settings2 size={14} />
                   </div>
                   <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Operational Logic</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Toggle 1: Require approval before export */}
                  <div className="flex items-center justify-between p-8 bg-muted/10 border border-border rounded-[32px] group hover:bg-background transition-all">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground"> Verification Protocol</p>
                      <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed max-w-sm">
                        Enforce administrative audit on all processed vectors before external transmission.
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
                  <div className={cn(
                     "flex flex-col p-8 border rounded-[32px] transition-all duration-300",
                     workspace.minimum_score_to_export ? "bg-background border-primary/30 shadow-xl shadow-primary/5" : "bg-muted/10 border-border group hover:bg-background"
                  )}>
                    <div className="flex items-center justify-between w-full">
                       <div className="space-y-1">
                          <p className={cn(
                             "text-sm font-bold",
                             workspace.minimum_score_to_export ? "text-primary" : "text-foreground"
                          )}>Linguistic Floor</p>
                          <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed max-w-sm">
                             Neutralize external transmission for vectors failing to achieve defined quality indices.
                          </p>
                       </div>
                       <Toggle
                         checked={workspace.minimum_score_to_export}
                         onChange={(val) =>
                           handleToggle("minimum_score_to_export", val)
                         }
                       />
                    </div>
                    
                    {workspace.minimum_score_to_export && (
                      <div className="mt-6 pt-6 border-t border-border/50 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-bold text-foreground">Score Threshold</p>
                          <p className="text-[10px] text-muted-foreground">Minimum score required for export (1.0 - 10.0)</p>
                        </div>
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
                          className="w-20 h-11 px-2 text-sm border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 bg-background font-bold"
                        />
                      </div>
                    )}
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
