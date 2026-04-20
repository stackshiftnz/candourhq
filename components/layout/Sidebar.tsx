"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  FilePlus,
  History,
  Palette,
  Settings2,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navItems = [
  { label: "Dashboard",      href: "/dashboard",     icon: LayoutDashboard },
  { label: "New document",   href: "/new",            icon: FilePlus },
  { label: "History",        href: "/history",        icon: History },
  { label: "Brand profiles", href: "/settings/brand", icon: Palette },
  { label: "Settings",       href: "/settings/team",  icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [activeBrandName, setActiveBrandName] = useState("My brand");
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setIsCollapsed(true);
  }, []);

  useEffect(() => {
    supabase
      .from("brand_profiles")
      .select("name")
      .eq("is_default", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setActiveBrandName(data.name);
      });
  }, [supabase]);

  function toggleCollapsed() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/signin");
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen flex flex-col bg-background/80 backdrop-blur-md border-r border-border overflow-hidden transition-all duration-300 ease-in-out z-50",
        isCollapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      {/* Header: Logo + Toggle */}
      <div className={cn(
        "flex items-center shrink-0 h-16",
        isCollapsed ? "justify-center" : "px-4 justify-between"
      )}>
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="shrink-0 w-8 h-8 flex items-center justify-center">
            <Image
              src="/logo-icon.png"
              alt="Candour HQ"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
              Candour
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {isCollapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground transition-all"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Brand Context (Expanded Only) */}
      {!isCollapsed && (activeBrandName) && (
        <div className="px-4 py-2 border-y border-border/50 mb-4 flex items-center gap-2 overflow-hidden bg-muted/30">
          <div className="w-5 h-5 rounded bg-primary flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-primary-foreground uppercase shadow-sm">
            {activeBrandName.charAt(0)}
          </div>
          <span className="text-[10px] font-bold text-muted-foreground truncate uppercase tracking-widest">
            {activeBrandName}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md transition-all duration-200 group",
                isCollapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={isCollapsed ? 20 : 18} className={cn(
                "shrink-0",
                !active && "group-hover:scale-105 transition-transform"
              )} />
              {!isCollapsed && (
                <span className="text-sm font-bold tracking-tight">{item.label}</span>
              )}
              {isCollapsed && (
                <div className="sr-only">{item.label}</div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className={cn(
        "p-3 mt-auto border-t border-border space-y-2",
        isCollapsed ? "flex flex-col items-center" : ""
      )}>
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed ? "flex-col" : "justify-between"
        )}>
          <ThemeToggle />
          {!isCollapsed && (
            <button
              onClick={handleSignOut}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          )}
          {isCollapsed && (
            <button
              onClick={handleSignOut}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <div className="pt-2">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-full bg-[#ffd480] text-[#181818] flex items-center justify-center text-xs font-bold shrink-0">
                A
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  Admin User
                </p>
                <p className="text-[9px] font-bold text-muted-foreground truncate uppercase tracking-widest">
                  {activeBrandName}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
