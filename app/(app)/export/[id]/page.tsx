import { createClient } from "@/lib/supabase/server-user";
import { notFound } from "next/navigation";
import ExportContent from "@/components/export/ExportContent";

interface ExportPageProps {
  params: {
    id: string;
  };
}

export default async function ExportPage({ params }: ExportPageProps) {
  const { id } = params;
  const supabase = createClient();

  // 1. Fetch document, diagnosis, and cleanup
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("*, brand_profiles(*)")
    .eq("id", id)
    .single();

  if (docError || !document) {
    notFound();
  }

  const { data: diagnosis, error: diagError } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("document_id", id)
    .single();

  if (diagError || !diagnosis) {
    // If diagnosis missing, we shouldn't be here
    notFound();
  }

  const { data: cleanup, error: cleanError } = await supabase
    .from("cleanups")
    .select("*")
    .eq("document_id", id)
    .single();

  if (cleanError || !cleanup) {
    // If cleanup missing, we shouldn't be here
    notFound();
  }

  // 2. Update status to 'exported'
  await supabase
    .from("documents")
    .update({ status: "exported", updated_at: new Date().toISOString() })
    .eq("id", id);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <ExportContent 
        document={document}
        diagnosis={diagnosis}
        cleanup={cleanup}
        brandProfile={document.brand_profiles}
      />
    </div>
  );
}
