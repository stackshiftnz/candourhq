import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
import { 
  Document as PdfDocument, 
  Page, 
  Text, 
  StyleSheet 
} from "@react-pdf/renderer";

function sanitiseFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/[^a-z0-9-]/g, '') // remove special chars
    .replace(/-+/g, '-') // consolidate hyphens
    .replace(/^-|-$/g, ''); // remove leading/trailing hyphens
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const documentId = searchParams.get("documentId");

  if (!type || !documentId) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  const supabase = createClient();

  // 1. Fetch document, diagnosis, cleanup, profiling
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("*, brand_profiles(*)")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const { data: cleanup, error: cleanError } = await supabase
    .from("cleanups")
    .select("*")
    .eq("document_id", documentId)
    .single();

  if (cleanError || !cleanup || !cleanup.final_content) {
    return new NextResponse("Document not cleaned up yet", { status: 400 });
  }

  const { data: diagnosis, error: diagError } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("document_id", documentId)
    .single();

  if (diagError || !diagnosis) {
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
                      text: p.cleaned!,
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
            <Text style={pdfStyles.title}>{document.title}</Text>
            {((cleanup.paragraphs as CleanupParagraph[]) || [])
              .filter((p: CleanupParagraph) => p.type === 'clean' && p.cleaned)
              .map((p: CleanupParagraph, i: number) => (
                <Text key={i} style={pdfStyles.paragraph}>{p.cleaned}</Text>
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

      const provenance = {
        issuesFound: cleanup.issues_total,
        issuesResolved: cleanup.issues_resolved,
        pauseCardsTotal: cleanup.pause_cards_total,
        pauseCardsAnswered: cleanup.pause_cards_answered,
        manualEdits: cleanup.user_edits?.length || 0,
      };

      const buffer = await renderToBuffer(
        <QualityReportTemplate 
          documentTitle={document.title || "Untitled Document"}
          contentType={document.content_type || "Document"}
          wordCount={document.word_count || 0}
          language={document.brand_profiles?.language_variant || document.language_variant || "en-US"}
          brandProfile={document.brand_profiles?.name || "Standard Profile"}
          scores={scores}
          provenance={provenance}
          exportedAt={document.updated_at || new Date().toISOString()}
          // New detailed info
          documentId={document.id}
          diagnosisId={diagnosis.id}
          cleanupId={cleanup.id}
          brandProfileId={document.brand_profile_id || "default"}
          headlineFinding={diagnosis.headline_finding || "Your content has been refined for maximum clarity and impact."}
          issues={diagnosis.issues || []}
          paragraphs={cleanup.paragraphs as CleanupParagraph[]}
          analysedAt={diagnosis.created_at || document.created_at}
          cleanedAt={cleanup.created_at || document.updated_at || document.created_at}
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
}
