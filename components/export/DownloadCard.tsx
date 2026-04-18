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
        "flex flex-col items-start p-4 bg-white border rounded-xl text-left transition-all hover:shadow-sm active:scale-95 group",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1",
        primary ? "border-gray-900 border-2" : "border-gray-200"
      )}
    >
      <div className={cn("p-2 rounded-lg mb-3 shadow-sm", iconBg)} aria-hidden="true">
        <Icon size={20} className={iconColor} />
      </div>
      <h3 className="text-[13px] font-semibold text-gray-900 mb-1 group-hover:text-gray-700">
        {title}
      </h3>
      <p className="text-[11px] text-gray-500 leading-tight">
        {description}
      </p>
    </button>
  );
}
