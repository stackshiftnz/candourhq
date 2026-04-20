import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

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
        "flex flex-col p-6 bg-muted/30 border border-border rounded-[28px] transition-all duration-300 group relative overflow-hidden",
        "hover:bg-background hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 active:scale-95",
        className
      )}
    >
      <div className="flex flex-col gap-1 relative z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary transition-colors">
          {subLabel}
        </span>
        <div className="flex items-center justify-between">
           <span className="text-sm font-bold text-foreground group-hover:text-foreground">
             {title}
           </span>
           <ArrowRight 
             size={16} 
             className="text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" 
           />
        </div>
      </div>
      
      {/* Subtle indicator */}
      <div className="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
         <ArrowRight size={48} strokeWidth={4} />
      </div>
    </Link>
  );
}
