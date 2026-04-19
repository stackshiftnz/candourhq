import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server-user";
import type { CleanupParagraph } from "@/types/database";
import type { DiagnosisResponse } from "@/lib/anthropic/types";
import { SamplePageClient } from "@/components/sample/SamplePageClient";

export default async function SamplePage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  // Fetch active sample content
  const { data: sample } = await supabase
    .from("sample_content")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  if (!sample) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-gray-500">
        Sample content not found. Run the seed SQL to set it up.
      </div>
    );
  }

  // Determine skip-path: user has no writing examples on their brand profile
  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("name, writing_examples")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();

  const isSkipPath =
    !brandProfile || (brandProfile.writing_examples ?? []).length === 0;

  return (
    <SamplePageClient
      userId={user.id}
      sample={{
        title: sample.title,
        content: sample.content,
        paragraphs: sample.paragraphs as unknown as CleanupParagraph[],
        diagnosis: sample.diagnosis as unknown as DiagnosisResponse,
      }}
      isSkipPath={isSkipPath}
    />
  );
}
