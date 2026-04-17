import React from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  mobileLabel?: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs = ({ tabs, activeTab, onChange, className }: TabsProps) => {
  return (
    <div className={cn("flex w-full border-b border-gray-200 bg-gray-50", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center h-11 text-sm transition-colors relative",
              isActive
                ? "bg-white font-medium text-gray-900 border-b-2 border-gray-900"
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            {tab.icon && <span className="mr-2 hidden sm:inline">{tab.icon}</span>}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.mobileLabel || tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
