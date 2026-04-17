import React from "react";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";

interface ProvenanceRecordCardProps {
  title: string;
  contentType: string;
  wordCount: number;
  language: string;
  brandProfile: string;
  issuesFound: number;
  issuesResolved: number;
  pauseCardsTotal: number;
  pauseCardsAnswered: number;
  manualEditsCount: number;
  exportedAt: string;
}

export function ProvenanceRecordCard({
  title,
  contentType,
  wordCount,
  language,
  brandProfile,
  issuesFound,
  issuesResolved,
  pauseCardsTotal,
  pauseCardsAnswered,
  manualEditsCount,
  exportedAt
}: ProvenanceRecordCardProps) {
  const isFullyResolved = issuesResolved === issuesFound;

  const row = (label: string, value: string | number | React.ReactNode) => (
    <div className="py-2.5 px-4 border-b border-gray-100 flex justify-between items-center last:border-0 hover:bg-gray-50/50 transition-colors">
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
      <span className="text-[11px] text-gray-900 font-medium">{value}</span>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-100 bg-gray-50/30">
        <h3 className="text-[13px] font-bold text-gray-900 truncate mb-1">
          {title}
        </h3>
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">
          Saved · {format(new Date(exportedAt), "MMM d, yyyy · h:mm a")}
        </p>
      </div>

      <div className="flex flex-col">
        {row("Content type", contentType.replace("_", " "))}
        {row("Word count", `${wordCount} words`)}
        {row("Language", language)}
        {row("Brand profile", brandProfile)}
        {row("Issues found", issuesFound)}
        {row("Issues resolved", `${issuesResolved} of ${issuesFound}`)}
        {row("Pause cards answered", `${pauseCardsAnswered} of ${pauseCardsTotal}`)}
        {row("Manual edits", manualEditsCount > 0 ? `${manualEditsCount} paragraph(s)` : "None")}
        {row(
          "Archive status",
          <Badge variant={isFullyResolved ? "success" : "warning"} size="sm">
            {isFullyResolved ? "Saved" : "Partial"}
          </Badge>
        )}
      </div>
    </div>
  );
}
