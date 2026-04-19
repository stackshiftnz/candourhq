import { createClient } from "@/lib/supabase/server-user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  TeamWorkspaceClient,
  type TeamMemberWithProfile,
  type PendingInvitation,
  type SubmittedDocument,
  type WorkspaceData,
} from "@/components/team/TeamWorkspaceClient";
import type { Database } from "@/types/database";

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

  if (plan === "trial" || plan === "solo") {
    return <PlanGate allBrandProfiles={allProfiles ?? []} />;
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
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-sm">Failed to load workspace.</p>
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
}: {
  allBrandProfiles: Array<{ id: string; name: string; is_default: boolean }>;
}) {
  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-white">
      {/* Left nav */}
      <aside className="hidden lg:flex flex-col w-[180px] flex-shrink-0 border-r border-gray-100 bg-gray-50 py-4 overflow-y-auto">
        {allBrandProfiles.length > 0 && (
          <>
            <div className="px-4 mb-2">
              <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-gray-400">
                Brand profiles
              </p>
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
          <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-gray-400">
            Account
          </p>
        </div>
        <nav>
          <Link
            href="/settings/billing"
            className="flex items-center px-4 py-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Plan and billing
          </Link>
          <Link
            href="/settings/team"
            className="flex items-center px-4 py-2 text-[13px] font-medium text-gray-900 bg-white border-r-2 border-gray-900 transition-colors"
          >
            Team members
          </Link>
          <Link
            href="/settings/notifications"
            className="flex items-center px-4 py-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Notifications
          </Link>
        </nav>
      </aside>

      {/* Gate content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Lock size={20} className="text-gray-400" />
          </div>
          <h2 className="text-[17px] font-medium text-gray-900">
            Team features are available on the Team plan
          </h2>
          <p className="text-[13px] text-gray-500">
            Invite members, set roles, manage an approval queue, and configure
            workflow rules with a Team or Agency subscription.
          </p>
          <Link href="/settings/billing">
            <Button variant="primary" className="mt-2">
              Upgrade plan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
