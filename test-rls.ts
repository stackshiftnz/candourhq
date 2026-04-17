import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function runRlsTest() {
  console.log("Creating test users...");
  
  const userAEmail = `user-a-${Date.now()}@example.com`;
  const userBEmail = `user-b-${Date.now()}@example.com`;
  const password = "Password123!";

  const { data: userAData, error: userAError } = await adminClient.auth.admin.createUser({
    email: userAEmail,
    password: password,
    email_confirm: true,
  });

  const { data: userBData, error: userBError } = await adminClient.auth.admin.createUser({
    email: userBEmail,
    password: password,
    email_confirm: true,
  });

  if (userAError || userBError) {
    console.error("Failed to create users:", userAError, userBError);
    return;
  }

  const userAId = userAData.user.id;
  const userBId = userBData.user.id;

  console.log(`User A: ${userAId}`);
  console.log(`User B: ${userBId}`);

  // Create document and brand profile as User A
  console.log("Creating documents and profiles as User A...");
  const userAClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: sessionA, error: loginErrorA } = await userAClient.auth.signInWithPassword({
    email: userAEmail,
    password: password,
  });

  const profileId = crypto.randomUUID();
  const documentId = crypto.randomUUID();

  // Profile as User A
  const { error: profileError } = await userAClient
    .from("brand_profiles")
    .insert({
      id: profileId,
      name: "User A Profile",
      language_variant: "en-US",
      user_id: userAId,
    });

  if (profileError) console.error("Error creating profile:", profileError);

  // Document as User A
  const { error: docError } = await userAClient
    .from("documents")
    .insert({
      id: documentId,
      title: "User A Document",
      original_content: "Hello world",
      word_count: 2,
      content_type: "general",
      language_variant: "en-US",
      status: "pending",
      user_id: userAId,
    });

  if (docError) console.error("Error creating document:", docError);

  console.log(`Created Profile ${profileId} and Document ${documentId}`);

  // Now login as User B
  console.log("Logging in as User B...");
  const userBClient = createClient(supabaseUrl, supabaseAnonKey);
  await userBClient.auth.signInWithPassword({
    email: userBEmail,
    password: password,
  });

  // Attempt to fetch User A's data as User B
  console.log("Checking RLS: Attempting to fetch User A's data as User B...");
  
  const { data: bDocs, error: bDocError } = await userBClient
    .from("documents")
    .select("*")
    .eq("id", documentId);

  const { data: bProfiles, error: bProfileError } = await userBClient
    .from("brand_profiles")
    .select("*")
    .eq("id", profileId);

  if (bDocs && bDocs.length > 0) {
    console.error("❌ RLS FAILURE: User B can see User A's document", bDocs);
  } else {
    console.log("✅ RLS SUCCESS: User B cannot see User A's document");
  }

  if (bProfiles && bProfiles.length > 0) {
    console.error("❌ RLS FAILURE: User B can see User A's profile", bProfiles);
  } else {
    console.log("✅ RLS SUCCESS: User B cannot see User A's profile");
  }

  // Cleanup
  console.log("Cleaning up test users...");
  await adminClient.auth.admin.deleteUser(userAId);
  await adminClient.auth.admin.deleteUser(userBId);
  console.log("Done.");
}

runRlsTest().catch(console.error);
