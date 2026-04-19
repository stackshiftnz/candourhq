"use server";

import { createClient } from "@/lib/supabase/server-user";

export async function skipOnboarding(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Verify the caller matches the authenticated session — never trust a
  // client-supplied userId without server-side confirmation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Insert a default brand profile for the user.
  const { error: insertError } = await supabase.from("brand_profiles").insert({
    user_id: userId,
    name: "Default profile",
    language_variant: "en-US",
    tone: "conversational",
    writing_examples: [],
    banned_phrases: [],
    approved_phrases: [],
    is_default: true,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  // Mark the user's profile as onboarding-complete.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

// ─── saveProfile ──────────────────────────────────────────────────────────────

export async function saveProfile(
  userId: string,
  data: {
    name: string;
    languageVariant: "en-US" | "en-GB";
    tone: string;
    writingExamples: string[];
  }
): Promise<{ success: boolean; profileId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profile, error: insertError } = await supabase
    .from("brand_profiles")
    .insert({
      user_id: userId,
      name: data.name,
      language_variant: data.languageVariant,
      tone: data.tone,
      writing_examples: data.writingExamples,
      banned_phrases: [],
      approved_phrases: [],
      is_default: true,
    })
    .select("id")
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true, profileId: profile.id };
}
