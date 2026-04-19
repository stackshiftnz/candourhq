
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function test() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  console.log(`Testing Supabase at ${url}...`);
  const supabase = createClient(url, key);

  const { data, error } = await supabase.from("profiles").select("count").limit(1);

  if (error) {
    console.error("Supabase error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  } else {
    console.log("Supabase connection successful! Found profiles.");
    process.exit(0);
  }
}

test();
