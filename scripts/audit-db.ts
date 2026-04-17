import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// parse .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
let envData = "";
try { envData = fs.readFileSync(envPath, "utf-8"); } catch (e) {}
const envMap: Record<string, string> = {};
envData.split("\n").forEach(line => {
    const parts = line.split("=");
    if(parts.length >= 2) envMap[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const supabaseUrl = envMap["NEXT_PUBLIC_SUPABASE_URL"] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envMap["SUPABASE_SERVICE_ROLE_KEY"] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
    console.log("--- TEST USERS ---");
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) console.error("Error fetching users:", userError);
    else {
        users.users.forEach(u => console.log(u.email));
    }

    console.log("\n--- SAMPLE CONTENT ---");
    const { data: samples } = await supabase.from("sample_content").select("id, is_active");
    console.log(samples);

    console.log("\n--- TEST DOCUMENTS ---");
    // Look for documents belonging to test users
    const testEmails = ["test", "example", "temp"];
    const testUsers = users?.users.filter(u => testEmails.some(te => u.email?.includes(te))) || [];
    for (const tu of testUsers) {
        const { data: docs } = await supabase.from("documents").select("id, title").eq("user_id", tu.id);
        console.log(`Docs for ${tu.email}:`, docs);
    }
}
run();
