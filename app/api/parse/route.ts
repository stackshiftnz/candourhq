import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { getWordCount } from "@/lib/utils/word-count";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Enforce 5MB server-side limit
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 5MB." },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let text = "";

    const filename = file.name.toLowerCase();
    
    // Check file type by extension
    if (filename.endsWith(".docx")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        return NextResponse.json(
          { error: "There was an issue reading your file. Please try a different format or paste the text." },
          { status: 500 }
        );
      }
    } else if (filename.endsWith(".pdf")) {
      try {
        // pdf-parse is marked as serverComponentsExternalPackages in next.config.mjs
        // so Node's native require() is used (CJS), avoiding webpack ESM issues.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
        const result = await pdfParse(buffer);
        text = result.text;

        // Scanned PDF detection: if text is empty or only whitespace
        if (!text || !text.trim()) {
          return NextResponse.json(
            { error: "This PDF appears to be a scanned image. Candour cannot read it. Please paste the text directly." },
            { status: 422 }
          );
        }
      } catch (e) {
        // Password protection check
        const msg = (e as Error).message?.toLowerCase() || "";
        if (msg.includes("password")) {
          return NextResponse.json(
            { error: "This PDF is password-protected. Please remove the password or paste the text instead." },
            { status: 422 }
          );
        }
        return NextResponse.json(
          { error: "There was an issue reading your file. Please try a different format or paste the text." },
          { status: 500 }
        );
      }
    } else if (filename.endsWith(".txt")) {
      try {
        text = buffer.toString("utf-8");
      } catch {
        return NextResponse.json(
          { error: "There was an issue reading your file. Please try a different format or paste the text." },
          { status: 500 }
        );
      }
    } else {
      // Unsupported type
      return NextResponse.json(
        { error: "Unsupported file type. Please upload DOCX, PDF, or TXT." },
        { status: 415 }
      );
    }

    const wordCount = getWordCount(text);

    return NextResponse.json({ text, wordCount });
  } catch (error) {
    console.error("Critical parsing error:", error);
    return NextResponse.json(
      { error: "There was an issue reading your file. Please try a different format or paste the text." },
      { status: 500 }
    );
  }
}
