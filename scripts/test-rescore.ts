/**
 * Test script for the Rescore API.
 * Usage: npx ts-node scripts/test-rescore.ts <DOCUMENT_ID>
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testRescore() {
  const documentId = process.argv[2];

  if (!documentId) {
    console.error("Please provide a document ID.");
    console.log("Usage: npx ts-node scripts/test-rescore.ts <DOCUMENT_ID>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`Testing Rescore API for Document: ${documentId}`);

  // 1. Verify document and cleanup exist
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("status, original_content")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    console.error("Error: Document not found in Supabase.");
    return;
  }

  const { data: cleanup, error: cleanError } = await supabase
    .from("cleanups")
    .select("final_content")
    .eq("document_id", documentId)
    .single();

  if (cleanError || !cleanup) {
    console.error("Error: Cleanup record not found for this document.");
    return;
  }

  if (!cleanup.final_content) {
    console.warn("Warning: final_content is null. API call expected to fail with 400.");
  }

  // 2. Call the API route
  // Note: We need a valid session to call the API if it checks for auth.
  // In a real test environment, we'd mock the session or use a service key bypass if the API allows.
  // Since the API uses supabase.auth.getSession(), we can't easily call it from here without a JWT.
  
  console.log("\nCalling /api/rescore...");
  
  try {
    // We'll simulate the POST request. 
    // Since we're likely running this locally, we'll try to hit the local dev server.
    const response = await fetch(`${appUrl}/api/rescore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // We'd need a cookie or Authorization header here for Next.js auth
      },
      body: JSON.stringify({ documentId }),
    });

    const result = await response.json();
    console.log("Status:", response.status);
    console.log("Response Body:", JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log("\n✅ Success! Checking database for updates...");
      const { data: diagnosis } = await supabase
        .from("diagnoses")
        .select("substance_score_final, style_score_final, trust_score_final, average_score_final")
        .eq("document_id", documentId)
        .single();
      
      console.log("Final Scores in DB:", diagnosis);
    } else {
      console.log("\n❌ API returned an error (expected if unauthorized or no final_content).");
    }

  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testRescore();
