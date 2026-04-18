import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { DiagnosisIssue, CleanupParagraph, ChangeTag } from "@/lib/anthropic/types";
import type { BrandProfileSnapshot, ExecutiveSummary, UserEdit } from "@/types/database";

function truncate(value: string, max: number): string {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

// Note: react-pdf only supports a subset of CSS
const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  // Header
  header: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 20,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0a57f2", // Stack Shift Blue
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 10,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  documentTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 20,
  },
  metaItem: {
    flexDirection: "column",
  },
  metaLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    color: "#4B5563",
    fontWeight: "medium",
  },

  // Score Table
  scoreTable: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRowLast: {
    flexDirection: "row",
    backgroundColor: "#FDFDFD",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  colSignal: { flex: 2 },
  colScore: { flex: 1, alignItems: "flex-end" },
  headerText: {
    fontSize: 8,
    color: "#9CA3AF",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  cellLabel: {
    fontSize: 10,
    color: "#4B5563",
  },
  cellScore: {
    fontSize: 10,
    color: "#111827",
    fontWeight: "bold",
  },
  avgLabel: {
    fontSize: 10,
    color: "#111827",
    fontWeight: "bold",
  },
  avgScore: {
    fontSize: 11,
    color: "#047857", // Green-700
    fontWeight: "bold",
  },

  // Finding
  findingBox: {
    backgroundColor: "#EFF6FF", // Blue-50
    padding: 15,
    borderRadius: 8,
    marginBottom: 24,
  },
  findingLabel: {
    fontSize: 8,
    color: "#2563EB", // Blue-600
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 4,
  },
  findingText: {
    fontSize: 11,
    color: "#1E40AF", // Blue-800
    lineHeight: 1.4,
  },

  // Sections
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 4,
    marginBottom: 10,
  },
  section: {
    marginBottom: 20,
  },

  // Issues
  issueItem: {
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E7EB",
  },
  issueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  issuePhrase: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#111827",
  },
  issueCategory: {
    fontSize: 7,
    color: "#9CA3AF",
    textTransform: "uppercase",
    paddingTop: 1,
  },
  issueExplanation: {
    fontSize: 8,
    color: "#6B7280",
    lineHeight: 1.3,
  },

  // Changes
  changeGroup: {
    marginBottom: 12,
  },
  changeTag: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0D9488", // Teal-600
    backgroundColor: "#F0FDFA",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  changeDiff: {
    fontSize: 8,
    color: "#4B5563",
    paddingLeft: 6,
  },
  oldText: {
    color: "#9CA3AF",
    textDecoration: "line-through",
  },
  newText: {
    color: "#111827",
    fontWeight: "medium",
  },

  // Audit
  auditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  auditText: {
    fontSize: 9,
    color: "#6B7280",
  },
  auditValue: {
    fontSize: 9,
    color: "#111827",
    fontWeight: "medium",
  },

  // Executive summary
  execSummaryBox: {
    backgroundColor: "#F9FAFB",
    borderLeftWidth: 3,
    borderLeftColor: "#0a57f2",
    padding: 12,
    marginBottom: 20,
  },
  execSummaryLabel: {
    fontSize: 8,
    color: "#0a57f2",
    textTransform: "uppercase",
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  execSummaryBullet: {
    fontSize: 10,
    color: "#111827",
    lineHeight: 1.4,
    marginBottom: 4,
  },

  // Brand snapshot
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  snapshotCell: {
    width: "48%",
    marginBottom: 6,
  },
  snapshotLabel: {
    fontSize: 7,
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 1,
  },
  snapshotValue: {
    fontSize: 9,
    color: "#111827",
  },

  // Edit audit
  editRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  editColIndex: {
    width: 30,
    fontSize: 8,
    color: "#9CA3AF",
    fontWeight: "bold",
  },
  editColBody: {
    flex: 1,
  },
  editMeta: {
    fontSize: 7,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  editDiff: {
    fontSize: 8,
    color: "#4B5563",
    lineHeight: 1.3,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  footerGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  footerInfo: {
    fontSize: 7,
    color: "#9CA3AF",
  },
  branding: {
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
  }
});

interface QualityReportProps {
  documentTitle: string;
  contentType: string;
  wordCount: number;
  language: string;
  brandProfile: string;
  scores: {
    original: {
      substance: number;
      style: number;
      trust: number;
      average: number;
    };
    final: {
      substance: number;
      style: number;
      trust: number;
      average: number;
    };
  };
  provenance: {
    issuesFound: number;
    issuesResolved: number;
    pauseCardsTotal: number;
    pauseCardsAnswered: number;
    manualEdits: number;
  };
  exportedAt: string;
  // Detailed data
  documentId: string;
  diagnosisId: string;
  cleanupId: string;
  brandProfileId: string;
  headlineFinding: string;
  issues: DiagnosisIssue[];
  paragraphs: CleanupParagraph[];
  analysedAt: string;
  cleanedAt: string;
  // Provenance upgrades
  executiveSummary: ExecutiveSummary | null;
  brandSnapshot: BrandProfileSnapshot | null;
  userEdits: UserEdit[];
  contentHash: string;
  ownerName: string | null;
}

export function QualityReportTemplate(props: QualityReportProps) {
  const {
    documentTitle, scores, provenance, exportedAt,
    headlineFinding, issues, paragraphs, analysedAt, cleanedAt,
    executiveSummary, brandSnapshot, userEdits, contentHash, ownerName
  } = props;

  // Group issues by priority
  const issuesByPriority = issues.reduce((acc, issue) => {
    const p = issue.priority || "other";
    if (!acc[p]) acc[p] = [];
    acc[p].push(issue);
    return acc;
  }, {} as Record<string, typeof issues>);

  // Collect and group changes
  const changesByTag: Record<string, ChangeTag[]> = {};
  paragraphs.forEach(p => {
    if (p.type === 'clean' && p.changes) {
      p.changes.forEach(c => {
        if (!changesByTag[c.tag]) changesByTag[c.tag] = [];
        changesByTag[c.tag].push(c);
      });
    }
  });

  // Collect pause cards
  const pauseCards = paragraphs
    .filter(p => p.type === 'pause' && p.pause_card)
    .map(p => p.pause_card!);

  const renderIssueGroup = (title: string, priority: string) => {
    const group = issuesByPriority[priority];
    if (!group?.length) return null;
    return (
      <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 9, fontWeight: "bold", color: "#6B7280", marginBottom: 6, textTransform: "capitalize" }}>
          {title}
        </Text>
        {group.map((issue, i) => (
            <View key={i} style={styles.issueItem}>
              <View style={styles.issueHeader}>
                <Text style={styles.issuePhrase}>&quot;{issue.phrase}&quot;</Text>
                <Text style={styles.issueCategory}>{issue.category.replace(/_/g, " ")}</Text>
              </View>
              <Text style={styles.issueExplanation}>{issue.explanation}</Text>
            </View>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>Candour HQ</Text>
          <Text style={styles.reportSubtitle}>Quality Assurance & Content Provenance</Text>
          <Text style={styles.documentTitle}>{documentTitle}</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Word Count</Text>
              <Text style={styles.metaValue}>{props.wordCount} words</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Brand Profile</Text>
              <Text style={styles.metaValue}>{props.brandProfile}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Language</Text>
              <Text style={styles.metaValue}>{props.language}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Exported at</Text>
              <Text style={styles.metaValue}>{format(new Date(exportedAt), "MMM d, yyyy · H:mm")}</Text>
            </View>
          </View>
        </View>

        {/* Executive Summary */}
        {executiveSummary && executiveSummary.bullets.length > 0 && (
          <View style={styles.execSummaryBox}>
            <Text style={styles.execSummaryLabel}>Executive Summary</Text>
            {executiveSummary.bullets.map((bullet, i) => (
              <Text key={i} style={styles.execSummaryBullet}>
                {"\u2022 "}{bullet}
              </Text>
            ))}
          </View>
        )}

        {/* Score Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quality Score Summary</Text>
          <View style={styles.scoreTable}>
            <View style={styles.tableHeader}>
              <View style={styles.colSignal}><Text style={styles.headerText}>Signal</Text></View>
              <View style={styles.colScore}><Text style={styles.headerText}>Original</Text></View>
              <View style={styles.colScore}><Text style={styles.headerText}>Final</Text></View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.colSignal}><Text style={styles.cellLabel}>Substance</Text></View>
              <View style={styles.colScore}><Text style={styles.cellLabel}>{scores.original.substance.toFixed(1)}</Text></View>
              <View style={styles.colScore}><Text style={styles.cellScore}>{scores.final.substance.toFixed(1)}</Text></View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.colSignal}><Text style={styles.cellLabel}>Style</Text></View>
              <View style={styles.colScore}><Text style={styles.cellLabel}>{scores.original.style.toFixed(1)}</Text></View>
              <View style={styles.colScore}><Text style={styles.cellScore}>{scores.final.style.toFixed(1)}</Text></View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.colSignal}><Text style={styles.cellLabel}>Trust</Text></View>
              <View style={styles.colScore}><Text style={styles.cellLabel}>{scores.original.trust.toFixed(1)}</Text></View>
              <View style={styles.colScore}><Text style={styles.cellScore}>{scores.final.trust.toFixed(1)}</Text></View>
            </View>
            <View style={styles.tableRowLast}>
              <View style={styles.colSignal}><Text style={styles.avgLabel}>Average Score</Text></View>
              <View style={styles.colScore}><Text style={styles.avgLabel}>{scores.original.average.toFixed(1)}</Text></View>
              <View style={styles.colScore}><Text style={styles.avgScore}>{scores.final.average.toFixed(1)}</Text></View>
            </View>
          </View>
        </View>

        {/* Finding */}
        <View style={styles.findingBox}>
          <Text style={styles.findingLabel}>Headline Finding</Text>
          <Text style={styles.findingText}>{headlineFinding}</Text>
        </View>

        {/* Issues Found */}
        {issues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compliance Issues Identified ({issues.length})</Text>
            {renderIssueGroup("Trust & Credibility", "trust")}
            {renderIssueGroup("Substance & Evidence", "substance")}
            {renderIssueGroup("Style & Tone", "style")}
          </View>
        )}

        {/* Changes Applied */}
        {Object.keys(changesByTag).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Strategic Refinements</Text>
            {Object.entries(changesByTag).map(([tag, changes]) => (
              <View key={tag} style={styles.changeGroup}>
                <Text style={styles.changeTag}>{tag.replace(/_/g, " ")}</Text>
                {changes.slice(0, 3).map((c, j) => (
                  <Text key={j} style={styles.changeDiff}>
                    <Text style={styles.oldText}>&quot;{c.original_phrase}&quot;</Text>
                    <Text> → </Text>
                    <Text style={styles.newText}>&quot;{c.cleaned_phrase}&quot;</Text>
                  </Text>
                ))}
                {changes.length > 3 && (
                  <Text style={{ fontSize: 7, color: "#9CA3AF", fontStyle: "italic", marginLeft: 6 }}>
                    + {changes.length - 3} more refinements
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Brand Profile Snapshot — frozen at the time of cleanup */}
        {brandSnapshot && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brand Profile Snapshot</Text>
            <Text style={{ fontSize: 8, color: "#9CA3AF", marginBottom: 8 }}>
              Captured {format(new Date(brandSnapshot.captured_at), "yyyy-MM-dd HH:mm")} — later changes to the profile do not alter this audit.
            </Text>
            <View style={styles.snapshotGrid}>
              <View style={styles.snapshotCell}>
                <Text style={styles.snapshotLabel}>Profile name</Text>
                <Text style={styles.snapshotValue}>{brandSnapshot.name}</Text>
              </View>
              <View style={styles.snapshotCell}>
                <Text style={styles.snapshotLabel}>Language</Text>
                <Text style={styles.snapshotValue}>{brandSnapshot.language_variant}</Text>
              </View>
              <View style={styles.snapshotCell}>
                <Text style={styles.snapshotLabel}>Tone</Text>
                <Text style={styles.snapshotValue}>{brandSnapshot.tone}</Text>
              </View>
              <View style={styles.snapshotCell}>
                <Text style={styles.snapshotLabel}>Writing examples</Text>
                <Text style={styles.snapshotValue}>{brandSnapshot.writing_examples.length} supplied</Text>
              </View>
              {brandSnapshot.banned_phrases.length > 0 && (
                <View style={styles.snapshotCell}>
                  <Text style={styles.snapshotLabel}>Banned phrases</Text>
                  <Text style={styles.snapshotValue}>{brandSnapshot.banned_phrases.slice(0, 6).join(", ")}{brandSnapshot.banned_phrases.length > 6 ? ", ..." : ""}</Text>
                </View>
              )}
              {brandSnapshot.approved_phrases.length > 0 && (
                <View style={styles.snapshotCell}>
                  <Text style={styles.snapshotLabel}>Approved phrases</Text>
                  <Text style={styles.snapshotValue}>{brandSnapshot.approved_phrases.slice(0, 6).join(", ")}{brandSnapshot.approved_phrases.length > 6 ? ", ..." : ""}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Audit Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Processing Audit Log</Text>
          {ownerName && (
            <View style={styles.auditRow}>
              <Text style={styles.auditText}>Document owner</Text>
              <Text style={styles.auditValue}>{ownerName}</Text>
            </View>
          )}
          <View style={styles.auditRow}>
            <Text style={styles.auditText}>Pause cards answered</Text>
            <Text style={styles.auditValue}>{provenance.pauseCardsAnswered} of {provenance.pauseCardsTotal}</Text>
          </View>
          {pauseCards.length > 0 && pauseCards.map((pc, i) => (
             <View key={i} style={{ marginLeft: 10, marginBottom: 4 }}>
                <Text style={{ fontSize: 8, color: "#9CA3AF" }}>Q: {pc.question}</Text>
                <Text style={{ fontSize: 8, color: "#111827" }}>A: {pc.user_answer || "Skipped"}</Text>
             </View>
          ))}
          <View style={styles.auditRow}>
            <Text style={styles.auditText}>Manual paragraph edits</Text>
            <Text style={styles.auditValue}>{provenance.manualEdits > 0 ? `${provenance.manualEdits} paragraph(s) directly edited` : "None"}</Text>
          </View>

          {userEdits.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 8, color: "#9CA3AF", textTransform: "uppercase", fontWeight: "bold", marginBottom: 6 }}>
                Manual edit trail
              </Text>
              {userEdits.map((edit, i) => (
                <View key={i} style={styles.editRow} wrap={false}>
                  <Text style={styles.editColIndex}>¶{edit.paragraph_index + 1}</Text>
                  <View style={styles.editColBody}>
                    <Text style={styles.editMeta}>
                      {format(new Date(edit.edited_at), "yyyy-MM-dd HH:mm")}
                      {ownerName ? ` · ${ownerName}` : ""}
                    </Text>
                    <Text style={styles.editDiff}>
                      <Text style={styles.oldText}>&quot;{truncate(edit.original_cleaned, 120)}&quot;</Text>
                      <Text> → </Text>
                      <Text style={styles.newText}>&quot;{truncate(edit.user_version, 120)}&quot;</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerGrid}>
            <View>
              <Text style={styles.footerInfo}>Doc ID: {props.documentId}</Text>
              <Text style={styles.footerInfo}>Profile ID: {props.brandProfileId}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.footerInfo}>Analysed: {format(new Date(analysedAt), "yyyy-MM-dd HH:mm")}</Text>
              <Text style={styles.footerInfo}>Cleaned: {format(new Date(cleanedAt), "yyyy-MM-dd HH:mm")}</Text>
              <Text style={styles.footerInfo}>Exported: {format(new Date(exportedAt), "yyyy-MM-dd HH:mm")}</Text>
            </View>
          </View>
          {contentHash && (
            <Text style={styles.footerInfo}>
              Content integrity (SHA-256): {contentHash}
            </Text>
          )}
          <Text style={styles.branding}>Generated by Candour HQ · candourhq.com</Text>
        </View>

      </Page>
    </Document>
  );
}
