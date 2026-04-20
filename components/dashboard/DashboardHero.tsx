"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Plus, 
  CircleCheck, 
  LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getGreeting } from "@/lib/utils/format";

interface DashboardHeroProps {
  userName: string;
  activeBrandName: string; // Kept for prop stability, though unused in UI now
  statusLine: string;
}

export function DashboardHero({ userName, statusLine }: DashboardHeroProps) {
  const [greeting, setGreeting] = useState("Hello");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    setGreeting(getGreeting(hour));
  }, []);

  return (
    <div className="relative mb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {mounted ? greeting : "Good day"}, <span className="text-primary">{userName}</span>.
          </h1>
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 opacity-80">
            <CircleCheck size={14} className="text-primary" strokeWidth={2.5} />
            {statusLine}
          </p>
        </div>

        <div className="flex items-center gap-3">
           <Button
            variant="ghost"
            size="md"
            className="hidden sm:flex rounded-xl font-bold text-sm h-11 border border-border hover:bg-muted/50"
           >
             <LayoutDashboard size={16} className="mr-2 opacity-60" />
             System Status
           </Button>

           <Link href="/new">
            <Button
              variant="brand"
              size="lg"
              className="rounded-xl px-6 shadow-lg shadow-secondary/5 hover:scale-[1.02] active:scale-[0.98] transition-all font-bold text-sm h-12"
            >
              <Plus size={18} strokeWidth={2.5} className="mr-2" />
              Analyze Document
            </Button>
           </Link>
        </div>
      </div>
    </div>
  );
}
