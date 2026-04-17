import { POST } from "../app/api/parse/route";
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Mocking Next.js request/response if necessary, but we can just call POST with a mocked Request
// Actually, it's easier to test the logic if we extract it, but the user asked for the route.

async function runTests() {
  console.log("Starting File Parsing API Route Tests...");

  // Mock Supabase session to bypass auth
  // In a real environment, we'd mock the createClient or just use a dummy session.
  // For this test, I'll temporarily disable the session check in the route or mock it.
  
  // Actually, I'll just write a test that mocks the Request object.
  
  const createMockRequest = (file: any) => {
    return {
      formData: async () => {
        const formData = new Map();
        formData.set("file", file);
        return {
          get: (key: string) => formData.get(key)
        };
      },
      auth: { getSession: async () => ({ data: { session: { user: { id: "test" } } } }) }
    } as any;
  };

  // 1. No file
  console.log("\nTest 1: No file");
  const res1 = await POST({
    formData: async () => { throw new Error("No form data"); }
  } as any);
  const data1 = await res1.json();
  console.log("Status:", res1.status, "Error:", data1.error);

  // 2. Too large
  console.log("\nTest 2: File too large (> 5MB)");
  const largeFile = {
    size: 6 * 1024 * 1024,
    name: "large.txt",
    arrayBuffer: async () => new ArrayBuffer(0)
  };
  const res2 = await POST(createMockRequest(largeFile));
  const data2 = await res2.json();
  console.log("Status:", res2.status, "Error:", data2.error);

  // 3. Unsupported type
  console.log("\nTest 3: Unsupported type (.jpg)");
  const jpgFile = {
    size: 100,
    name: "image.jpg",
    arrayBuffer: async () => new ArrayBuffer(0)
  };
  const res3 = await POST(createMockRequest(jpgFile));
  const data3 = await res3.json();
  console.log("Status:", res3.status, "Error:", data3.error);

  // 4. TXT upload
  console.log("\nTest 4: TXT file");
  const txtContent = "Hello, this is a test document with ten words in it.";
  const txtFile = {
    size: txtContent.length,
    name: "test.txt",
    arrayBuffer: async () => Buffer.from(txtContent)
  };
  const res4 = await POST(createMockRequest(txtFile));
  const data4 = await res4.json();
  console.log("Status:", res4.status, "Text:", data4.text, "Words:", data4.wordCount);

  console.log("\nTests completed.");
}

runTests().catch(console.error);
