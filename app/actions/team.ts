"use server";

import { createClient } from "@/lib/supabase/server-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ── inviteTeamMember ──────────────────────────────────────────────────────────

export async function inviteTeamMember(
  workspaceId: string,
  email: string,
  role: string
): Promise<{ success: boolean; error?: string; duplicate?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  // Check if already a member by email
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    const { data: alreadyMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (alreadyMember) return { success: false, duplicate: true };
  }

  // Check if already pending invited
  const { data: existingInvite } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("invited_email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) return { success: false, duplicate: true };

  // Insert invitation record
  const { error: insertError } = await supabase
    .from("team_invitations")
    .insert({
      workspace_id: workspaceId,
      invited_email: email,
      role,
      invited_by: user.id,
      status: "pending",
    });

  if (insertError) {
    if (insertError.code === "23505") return { success: false, duplicate: true };
    return { success: false, error: insertError.message };
  }

  // Send Supabase auth invite email
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?workspace_id=${workspaceId}`,
      data: { workspace_id: workspaceId, role },
    }
  );

  if (inviteError) {
    // Invitation record saved — email failure is non-fatal
    console.error("Invite email error:", inviteError.message);
  }

  return { success: true };
}

// ── cancelInvite ─────────────────────────────────────────────────────────────

export async function cancelInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("team_invitations")
    .update({ status: "cancelled" })
    .eq("id", inviteId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── removeMember ─────────────────────────────────────────────────────────────

export async function removeMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── approveDocument ───────────────────────────────────────────────────────────

export async function approveDocument(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("documents")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── requestChanges ────────────────────────────────────────────────────────────

export async function requestChanges(
  documentId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("documents")
    .update({
      status: "diagnosed",
      approval_note: note,
    })
    .eq("id", documentId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── updateWorkspaceSettings ───────────────────────────────────────────────────

export async function updateWorkspaceSettings(
  workspaceId: string,
  settings: {
    require_approval_before_export?: boolean;
    minimum_score_to_export?: boolean;
    minimum_score_threshold?: number;
    notify_on_submission?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("workspaces")
    .update(settings)
    .eq("id", workspaceId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── submitForApproval ─────────────────────────────────────────────────────────

export async function submitForApproval(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("documents")
    .update({
      status: "submitted",
      submitted_for_approval_at: new Date().toISOString(),
      submitted_by: user.id,
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
