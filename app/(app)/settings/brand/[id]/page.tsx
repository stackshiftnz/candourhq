import { createClient } from "@/lib/supabase/server-user";
import { notFound, redirect } from "next/navigation";
import { BrandProfileEditorClient } from "@/components/brand/BrandProfileEditorClient";

interface BrandSettingsPageProps {
  params: {
    id: string;
  };
}

export default async function BrandSettingsPage({
  params,
}: BrandSettingsPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // Fetch the specific profile (validates ownership via user_id)
  const { data: profile, error: profileError } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  // Fetch all profiles for the left nav (order: default first, then by created_at)
  const { data: allProfiles } = await supabase
    .from("brand_profiles")
    .select("id, name, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <BrandProfileEditorClient
      profile={profile}
      allProfiles={allProfiles ?? []}
    />
  );
}
