import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WhatNextCardProps {
  title: string;
  subLabel: string;
  href: string;
  className?: string;
}

export function WhatNextCard({ title, subLabel, href, className }: WhatNextCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col p-4 bg-gray-50 border border-gray-100 rounded-xl transition-all hover:bg-gray-100 group",
        className
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
        {subLabel}
      </span>
      <span className="text-[14px] font-medium text-gray-900 group-hover:text-gray-700">
        {title}
      </span>
    </Link>
  );
}
