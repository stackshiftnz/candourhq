import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DownloadCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}

export function DownloadCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  onClick,
  primary
}: DownloadCardProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`${title}. ${description}`}
      className={cn(
        "flex items-center gap-4 p-5 bg-card border rounded-[28px] text-left transition-all duration-300 group relative overflow-hidden",
        "hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 active:scale-95",
        "focus:outline-none focus:ring-4 focus:ring-primary/5",
        primary ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
      )}
    >
      {primary && (
        <div className="absolute top-0 right-0 p-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
      )}

      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
        "shadow-inner group-hover:scale-110",
        iconBg
      )} aria-hidden="true">
        <Icon size={22} className={iconColor} />
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-[11px] font-medium text-muted-foreground leading-tight opacity-70">
          {description}
        </p>
      </div>
    </button>
  );
}
