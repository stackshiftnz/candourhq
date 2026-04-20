import React from "react";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Calendar, 
  Hash, 
  Globe, 
  User, 
  CircleAlert, 
  CheckCheck, 
  MessageSquare, 
  Pencil,
  Shield
} from "lucide-react";

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

  const row = (label: string, value: string | number | React.ReactNode, icon: React.ReactNode) => (
    <div className="group py-3 px-6 border-b border-border/50 flex justify-between items-center last:border-0 hover:bg-muted/30 transition-all duration-300">
      <div className="flex items-center gap-2.5">
         <div className="text-muted-foreground/40 group-hover:text-primary/50 transition-colors">
            {icon}
         </div>
         <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-[11px] text-foreground font-bold tracking-tight">{value}</span>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl shadow-black/5">
      <div className="p-6 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 mb-2">
           <Shield size={12} className="text-primary" />
           <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Immutable Audit Record</span>
        </div>
        <h3 className="text-sm font-bold text-foreground truncate">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-2 opacity-50">
           <Calendar size={10} />
           <p className="text-[9px] font-bold tracking-tight">
             {format(new Date(exportedAt), "MMM d, yyyy · h:mm a")}
           </p>
        </div>
      </div>

      <div className="flex flex-col">
        {row("Content Class", contentType.replace("_", " "), <FileText size={12} />)}
        {row("Lexical Load", `${wordCount} vectors`, <Hash size={12} />)}
        {row("Linguistic Variant", language, <Globe size={12} />)}
        {row("Brand Matrix", brandProfile, <User size={12} />)}
        {row("Threats Identified", issuesFound, <CircleAlert size={12} />)}
        {row("Threats Neutralized", `${issuesResolved} / ${issuesFound}`, <CheckCheck size={12} />)}
        {row("State Interventions", `${pauseCardsAnswered} / ${pauseCardsTotal}`, <MessageSquare size={12} />)}
        {row("Manual Overlays", manualEditsCount > 0 ? manualEditsCount : "Zero", <Pencil size={12} />)}
        {row(
          "Snapshot Status",
          <div className={cn(
             "px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border",
             isFullyResolved ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-secondary/10 border-secondary/20 text-secondary"
          )}>
            {isFullyResolved ? "VERIFIED" : "PARTIAL"}
          </div>,
          <Shield size={12} />
        )}
      </div>
    </div>
  );
}
