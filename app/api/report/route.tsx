import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType
} from "docx";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { QualityReportTemplate } from "@/components/export/QualityReportTemplate";
import { CleanupParagraph } from "@/lib/anthropic/types";
import type { BrandProfileSnapshot, ExecutiveSummary, UserEdit } from "@/types/database";
import { anthropic } from "@/lib/anthropic/client";
import {
  EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
  buildExecutiveSummaryUserPrompt,
} from "@/lib/anthropic/prompts/executive-summary";
import {
  Document as PdfDocument,
  Page,
  Text,
  StyleSheet
} from "@react-pdf/renderer";

const EXECUTIVE_SUMMARY_MODEL = "claude-sonnet-4-6";

async function generateExecutiveSummary(args: {
  documentTitle: string;
  contentType: string;
  wordCount: number;
  brandProfileName: string;
  diagnosis: { substance_score: number | null; style_score: number | null; trust_score: number | null; average_score_original: number | null; substance_score_final: number | null; style_score_final: number | null; trust_score_final: number | null; average_score_final: number | null };
  issuesFound: number;
  issuesResolved: number;
  pauseCardsTotal: number;
  pauseCardsAnswered: number;
  manualEdits: number;
}): Promise<ExecutiveSummary | null> {
  try {
    const userPrompt = buildExecutiveSummaryUserPrompt({
      documentTitle: args.documentTitle,
      contentType: args.contentType,
      wordCount: args.wordCount,
      brandProfileName: args.brandProfileName,
      scoresBefore: {
        substance: args.diagnosis.substance_score || 0,
        style: args.diagnosis.style_score || 0,
        trust: args.diagnosis.trust_score || 0,
        average: args.diagnosis.average_score_original || 0,
      },
      scoresAfter: {
        substance: args.diagnosis.substance_score_final || args.diagnosis.substance_score || 0,
        style: args.diagnosis.style_score_final || args.diagnosis.style_score || 0,
        trust: args.diagnosis.trust_score_final || args.diagnosis.trust_score || 0,
        average: args.diagnosis.average_score_final || args.diagnosis.average_score_original || 0,
      },
      issuesFound: args.issuesFound,
      issuesResolved: args.issuesResolved,
      pauseCardsTotal: args.pauseCardsTotal,
      pauseCardsAnswered: args.pauseCardsAnswered,
      manualEdits: args.manualEdits,
    });

    const message = await anthropic.messages.create({
      model: EXECUTIVE_SUMMARY_MODEL,
      max_tokens: 400,
      system: EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const raw = textBlock.text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw) as { bullets: string[] };
    if (!Array.isArray(parsed.bullets) || parsed.bullets.length === 0) return null;

    return {
      bullets: parsed.bullets.slice(0, 3).map((b) => String(b).trim()),
      model: EXECUTIVE_SUMMARY_MODEL,
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[REPORT] executive summary generation failed:", err);
    return null;
  }
}

function sanitiseFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/[^a-z0-9-]/g, '') // remove special chars
    .replace(/-+/g, '-') // consolidate hyphens
    .replace(/^-|-$/g, ''); // remove leading/trailing hyphens
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const documentId = searchParams.get("documentId");

    if (!type || !documentId) {
      console.warn("[REPORT] Missing parameters:", { type, documentId });
      return new NextResponse("Missing parameters", { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch document, diagnosis, cleanup, profiling
    // Use .order().limit(1) to be resilient against duplicate records during development/failure states
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*, brand_profiles(*)")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("[REPORT] Document fetch error:", docError);
      return new NextResponse("Document not found", { status: 404 });
    }

    const { data: cleanup, error: cleanError } = await supabase
      .from("cleanups")
      .select("*")
      .eq("document_id", documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cleanError || !cleanup || !cleanup.final_content) {
      console.error("[REPORT] Cleanup check failed:", {
        documentId,
        cleanError,
        hasCleanup: !!cleanup,
        hasFinalContent: !!cleanup?.final_content
      });
      return new NextResponse("Document not cleaned up yet", { status: 400 });
    }

    const { data: diagnosis, error: diagError } = await supabase
      .from("diagnoses")
      .select("*")
      .eq("document_id", documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (diagError || !diagnosis) {
      console.error("[REPORT] Diagnosis fetch error:", diagError);
      return new NextResponse("Diagnosis not found", { status: 404 });
    }

    const baseName = sanitiseFilename(document.title || "untitled");

    // 2. Handle Export Types
    switch (type) {
      case "txt": {
        return new NextResponse(cleanup.final_content, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${baseName}-candour-clean.txt"`,
          },
        });
      }

      case "docx": {
        const docx = new DocxDocument({
          styles: {
            default: {
              document: {
                run: {
                  font: "Calibri",
                  size: 22, // 11pt
                },
              },
            },
          },
          sections: [
            {
              properties: {
                page: {
                  margin: {
                    top: 1440, // 1 inch
                    right: 1440,
                    bottom: 1440,
                    left: 1440,
                  },
                },
              },
              children: [
                new Paragraph({
                  text: document.title || "Untitled Document",
                  heading: HeadingLevel.HEADING_1,
                  spacing: { after: 400 },
                }),
                ...((cleanup.paragraphs as CleanupParagraph[]) || [])
                  .filter((p: CleanupParagraph) => p.type === 'clean' && p.cleaned)
                  .map((p: CleanupParagraph) => new Paragraph({
                    children: [
                      new TextRun({
                        text: p.cleaned || "",
                      }),
                    ],
                    spacing: { after: 200 },
                    alignment: AlignmentType.LEFT,
                  })),
              ],
            },
          ],
        });

        const buffer = await Packer.toBuffer(docx);
        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${baseName}-candour-clean.docx"`,
          },
        });
      }

      case "pdf": {
        const pdfStyles = StyleSheet.create({
          page: { padding: 72, fontFamily: "Helvetica" }, // 72pt = 1 inch
          title: { fontSize: 24, marginBottom: 20, fontWeight: "bold" },
          paragraph: { fontSize: 11, marginBottom: 12, lineHeight: 1.5, color: "#111827" },
        });

        const SimplePdf = () => (
          <PdfDocument>
            <Page style={pdfStyles.page}>
              <Text style={pdfStyles.title}>{document.title || "Untitled Document"}</Text>
              {((cleanup.paragraphs as CleanupParagraph[]) || [])
                .filter((p: CleanupParagraph) => p.type === 'clean' && p.cleaned)
                .map((p: CleanupParagraph, i: number) => (
                  <Text key={i} style={pdfStyles.paragraph}>{p.cleaned || ""}</Text>
                ))}
            </Page>
          </PdfDocument>
        );

        const buffer = await renderToBuffer(<SimplePdf />);
        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${baseName}-candour-clean.pdf"`,
          },
        });
      }

      case "quality-report": {
        const scores = {
          original: {
            substance: diagnosis.substance_score || 0,
            style: diagnosis.style_score || 0,
            trust: diagnosis.trust_score || 0,
            average: diagnosis.average_score_original || 0,
          },
          final: {
            substance: diagnosis.substance_score_final || diagnosis.substance_score || 0,
            style: diagnosis.style_score_final || diagnosis.style_score || 0,
            trust: diagnosis.trust_score_final || diagnosis.trust_score || 0,
            average: diagnosis.average_score_final || diagnosis.average_score_original || 0,
          }
        };

        const userEdits: UserEdit[] = (cleanup.user_edits as UserEdit[]) || [];
        const provenance = {
          issuesFound: cleanup.issues_total || 0,
          issuesResolved: cleanup.issues_resolved || 0,
          pauseCardsTotal: cleanup.pause_cards_total || 0,
          pauseCardsAnswered: cleanup.pause_cards_answered || 0,
          manualEdits: userEdits.length,
        };

        // Content hash — SHA-256 over the final content gives reviewers an
        // integrity signature they can compare later if the document is re-exported.
        const contentHash = cleanup.content_hash
          || createHash("sha256").update(cleanup.final_content || "").digest("hex");

        // Persist the hash the first time it's computed so subsequent exports
        // return the same value without recomputation.
        if (!cleanup.content_hash && cleanup.final_content) {
          await supabase
            .from("cleanups")
            .update({ content_hash: contentHash })
            .eq("id", cleanup.id);
        }

        // Executive summary — cached on the cleanup row. First export pays the
        // Anthropic cost; subsequent exports reuse the cached bullets.
        let executiveSummary = cleanup.executive_summary as ExecutiveSummary | null;
        if (!executiveSummary) {
          executiveSummary = await generateExecutiveSummary({
            documentTitle: document.title || "Untitled Document",
            contentType: document.content_type || "Document",
            wordCount: document.word_count || 0,
            brandProfileName: document.brand_profiles?.name || "Standard Profile",
            diagnosis: {
              substance_score: diagnosis.substance_score,
              style_score: diagnosis.style_score,
              trust_score: diagnosis.trust_score,
              average_score_original: diagnosis.average_score_original,
              substance_score_final: diagnosis.substance_score_final,
              style_score_final: diagnosis.style_score_final,
              trust_score_final: diagnosis.trust_score_final,
              average_score_final: diagnosis.average_score_final,
            },
            issuesFound: provenance.issuesFound,
            issuesResolved: provenance.issuesResolved,
            pauseCardsTotal: provenance.pauseCardsTotal,
            pauseCardsAnswered: provenance.pauseCardsAnswered,
            manualEdits: provenance.manualEdits,
          });

          if (executiveSummary) {
            await supabase
              .from("cleanups")
              .update({ executive_summary: executiveSummary })
              .eq("id", cleanup.id);
          }
        }

        const brandSnapshot = cleanup.brand_profile_snapshot as BrandProfileSnapshot | null;

        // Resolve the document owner's display name for the audit section. Falls
        // back silently if the profile row can't be read.
        let ownerName: string | null = null;
        if (document.user_id) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", document.user_id)
            .maybeSingle();
          ownerName = ownerProfile?.full_name || ownerProfile?.email || null;
        }

        const buffer = await renderToBuffer(
          <QualityReportTemplate
            documentTitle={document.title || "Untitled Document"}
            contentType={document.content_type || "Document"}
            wordCount={document.word_count || 0}
            language={brandSnapshot?.language_variant || document.brand_profiles?.language_variant || document.language_variant || "en-US"}
            brandProfile={brandSnapshot?.name || document.brand_profiles?.name || "Standard Profile"}
            scores={scores}
            provenance={provenance}
            exportedAt={document.updated_at || document.created_at || new Date().toISOString()}
            documentId={document.id}
            diagnosisId={diagnosis.id}
            cleanupId={cleanup.id}
            brandProfileId={document.brand_profile_id || "default"}
            headlineFinding={diagnosis.headline_finding || "Your content has been refined for maximum clarity and impact."}
            issues={diagnosis.issues || []}
            paragraphs={cleanup.paragraphs as CleanupParagraph[]}
            analysedAt={diagnosis.created_at || document.created_at}
            cleanedAt={cleanup.created_at || document.updated_at || document.created_at}
            executiveSummary={executiveSummary}
            brandSnapshot={brandSnapshot}
            userEdits={userEdits}
            contentHash={contentHash}
            ownerName={ownerName}
          />
        );

        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${baseName}-candour-quality-report.pdf"`,
          },
        });
      }

      default:
        return new NextResponse("Invalid export type", { status: 400 });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[REPORT-ERROR] Unhandled error in report generation:", {
      message: error.message,
      stack: error.stack,
    });
    return new NextResponse("An error occurred during report generation. Please try again.", { status: 500 });
  }
}
