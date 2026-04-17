import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const userId = "b11a91ae-b295-46fd-abff-9de90b4d45d8"; // just some random UUID for test or I'll query one
  
  const {data: docs} = await supabase.from("documents").select("user_id").limit(1);
  const uid = docs?.[0]?.user_id;
  if (!uid) { console.log("No user found"); return; }
  
  const [cleanups, diagnoses] = await Promise.all([
    supabase
      .from("cleanups")
      .select("issues_resolved, document_id, documents!inner(user_id)")
      .eq("documents.user_id", uid),
    supabase
      .from("diagnoses")
      .select("average_score_original, average_score_final, issues, document_id, documents!inner(user_id)")
      .eq("documents.user_id", uid),
  ]);
  
  console.log("cleanups:", cleanups.error ? cleanups.error : cleanups.data.length);
  console.log("diagnoses:", diagnoses.error ? diagnoses.error : diagnoses.data.length);
}
run();
