import { createClient } from "@/lib/supabase/server-user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Lock, 
  Settings2, 
  User, 
  ChevronRight, 
  CreditCard, 
  Users, 
  Bell, 
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  TeamWorkspaceClient,
  type TeamMemberWithProfile,
  type PendingInvitation,
  type SubmittedDocument,
  type WorkspaceData,
} from "@/components/team/TeamWorkspaceClient";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];
type TeamInvitationRow = Database["public"]["Tables"]["team_invitations"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type DiagnosisRow = Database["public"]["Tables"]["diagnoses"]["Row"];

export default async function TeamSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // ── Profile & plan gate ──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, full_name")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "trial";

  // Brand profiles for left nav
  const { data: allProfiles } = await supabase
    .from("brand_profiles")
    .select("id, name, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  const NAV_ACCOUNT_LINKS = [
    { label: "Plan and billing", href: "/settings/billing", icon: <CreditCard size={14} /> },
    { label: "Team members", href: "/settings/team", icon: <Users size={14} />, active: true },
    { label: "Notifications", href: "/settings/notifications", icon: <Bell size={14} /> },
  ];

  if (plan === "trial" || plan === "solo") {
    return <PlanGate allBrandProfiles={allProfiles ?? []} navLinks={NAV_ACCOUNT_LINKS} />;
  }

  // ── Workspace fetch or create ────────────────────────────────────────────
  let workspace: WorkspaceRow | null = null;

  // Check if user owns a workspace
  const { data: ownedWorkspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownedWorkspace) {
    workspace = ownedWorkspace;
  } else {
    // Check if user is a member of a workspace
    const { data: memberRecord } = await supabase
      .from("team_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberRecord) {
      const { data: memberWorkspace } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", memberRecord.workspace_id)
        .maybeSingle();
      workspace = memberWorkspace ?? null;
    }
  }

  // Create workspace if none exists
  if (!workspace) {
    const { data: newWorkspace } = await supabase
      .from("workspaces")
      .insert({
        name: `${profile?.full_name ?? "My"} Team`,
        owner_id: user.id,
        plan,
      })
      .select("*")
      .single();

    if (newWorkspace) {
      await supabase.from("team_members").insert({
        workspace_id: newWorkspace.id,
        user_id: user.id,
        role: "admin",
      });
      workspace = newWorkspace;
    }
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-4">
           <ShieldAlert className="text-muted-foreground/30" size={48} />
           <p className="text-muted-foreground text-xs font-bold">Workspace initialization failure</p>
        </div>
      </div>
    );
  }

  // ── Fetch team members ───────────────────────────────────────────────────
  const { data: rawMembers } = await supabase
    .from("team_members")
    .select("*")
    .eq("workspace_id", workspace.id);

  const memberRows: TeamMemberRow[] = rawMembers ?? [];
  const memberUserIds = memberRows.map((m) => m.user_id);

  const { data: memberProfiles } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", memberUserIds)
      : { data: [] };

  const members: TeamMemberWithProfile[] = memberRows.map((m) => {
    const p = (memberProfiles ?? []).find((mp) => mp.id === m.user_id);
    return {
      ...m,
      profile: {
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
      },
    };
  });

  // Current user's role
  const currentMember = members.find((m) => m.user_id === user.id);
  const currentUserRole = currentMember?.role ?? "editor";

  // ── Pending invitations ──────────────────────────────────────────────────
  const { data: rawInvitations } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const invitationRows: TeamInvitationRow[] = rawInvitations ?? [];
  const pendingInvitations: PendingInvitation[] = invitationRows.map((i) => ({
    id: i.id,
    workspace_id: i.workspace_id,
    invited_email: i.invited_email,
    role: i.role,
    status: i.status,
    created_at: i.created_at,
  }));

  // ── Submitted documents (approval queue) ────────────────────────────────
  const { data: rawSubmitted } = await supabase
    .from("documents")
    .select("id, title, submitted_for_approval_at, submitted_by")
    .eq("workspace_id", workspace.id)
    .eq("status", "submitted")
    .order("submitted_for_approval_at", { ascending: true });

  const submittedRows: Pick<
    DocumentRow,
    "id" | "title" | "submitted_for_approval_at" | "submitted_by"
  >[] = rawSubmitted ?? [];

  const submittedDocIds = submittedRows.map((d) => d.id);
  const submitterIds = Array.from(
    new Set(
      submittedRows.map((d) => d.submitted_by).filter((id): id is string => !!id)
    )
  );

  const [diagnosesResult, submitterProfilesResult] = await Promise.all([
    submittedDocIds.length > 0
      ? supabase
          .from("diagnoses")
          .select("document_id, average_score_final, average_score_original")
          .in("document_id", submittedDocIds)
      : Promise.resolve({ data: [] as Pick<DiagnosisRow, "document_id" | "average_score_final" | "average_score_original">[] }),
    submitterIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", submitterIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
  ]);

  const diagnosesData = diagnosesResult.data ?? [];
  const submitterProfiles = submitterProfilesResult.data ?? [];

  const submittedDocuments: SubmittedDocument[] = submittedRows.map((doc) => {
    const diag = diagnosesData.find((d) => d.document_id === doc.id);
    const submitterProfile = submitterProfiles.find(
      (p) => p.id === doc.submitted_by
    );
    return {
      id: doc.id,
      title: doc.title,
      submitted_for_approval_at: doc.submitted_for_approval_at,
      submitted_by_name: submitterProfile?.full_name ?? null,
      average_score_final: diag?.average_score_final ?? null,
      average_score_original: diag?.average_score_original ?? 0,
    };
  });

  const workspaceData: WorkspaceData = {
    id: workspace.id,
    name: workspace.name,
    owner_id: workspace.owner_id,
    require_approval_before_export: workspace.require_approval_before_export,
    minimum_score_to_export: workspace.minimum_score_to_export,
    minimum_score_threshold: workspace.minimum_score_threshold,
    notify_on_submission: workspace.notify_on_submission,
  };

  return (
    <TeamWorkspaceClient
      currentUserId={user.id}
      currentUserRole={currentUserRole}
      workspace={workspaceData}
      members={members}
      pendingInvitations={pendingInvitations}
      submittedDocuments={submittedDocuments}
      allBrandProfiles={allProfiles ?? []}
    />
  );
}

// ── Plan gate component ───────────────────────────────────────────────────────

function PlanGate({
  allBrandProfiles,
  navLinks,
}: {
  allBrandProfiles: Array<{ id: string; name: string; is_default: boolean }>;
  navLinks: Array<{ label: string; href: string; icon: React.ReactNode; active?: boolean }>;
}) {
  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background selection:bg-primary/20">
      {/* Left nav */}
      <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 border-r border-border bg-muted/20 py-8 overflow-y-auto">
        {allBrandProfiles.length > 0 && (
          <>
            <div className="px-6 mb-4">
               <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-2">
                 Identity Matrices
               </p>
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-2">
              Nexus Nodes
            </p>
        </div>
        <nav className="px-3 space-y-1">
          {navLinks.map((link) => (
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

      {/* Gate content */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 relative overflow-hidden">
        {/* Background Visual Flair */}
        <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2 pointer-events-none" />

        <div className="max-w-md w-full text-center space-y-8 relative z-10">
          <div className="relative inline-block">
             <div className="w-24 h-24 rounded-[40px] bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto transform rotate-6 hover:rotate-0 transition-transform duration-500 shadow-2xl shadow-primary/10">
                <Users size={40} className="text-primary" />
             </div>
             <div className="absolute -top-2 -right-2 w-10 h-10 rounded-2xl bg-foreground border-4 border-background flex items-center justify-center text-background shadow-xl">
                <Lock size={16} />
             </div>
          </div>

          <div className="space-y-3">
              <h2 className="text-4xl font-bold text-foreground tracking-tight leading-tight">
                Enterprise Collaboration Suite
              </h2>
             <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed">
               Industrial-grade team workflows are restricted to current plan constraints. Synchronize your team nodes to unlock collective intelligence features.
             </p>
          </div>

          <div className="grid grid-cols-1 gap-4 py-4">
             {[
               "Collective Identity Management",
               "Linguistic Approval Protocols",
               "Role-Based Permission Sets",
               "Centralized Verification Queue"
             ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4 rounded-3xl bg-muted/10 border border-border/50 text-left">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[11px] font-bold text-foreground/80">{feature}</span>
                </div>
             ))}
          </div>

          <Link href="/settings/billing" className="block transform hover:scale-[1.02] transition-transform active:scale-[0.98]">
            <Button className="h-16 px-12 rounded-[32px] font-bold text-sm bg-foreground text-background shadow-2xl shadow-black/20 group w-full">
              Advance Plan Tier
              <ArrowRight size={16} className="ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
            System Upgrade Required · v2.4.0
          </p>
        </div>
      </div>
    </div>
  );
}
