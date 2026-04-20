"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FilePlus, History, Palette, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "New", href: "/new", icon: FilePlus },
  { label: "History", href: "/history", icon: History },
  { label: "Brand", href: "/settings/brand", icon: Palette },
  { label: "Settings", href: "/settings/team", icon: Settings2 },
];

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-lg border-t border-border flex items-center z-50 px-2">
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200",
              active
                ? "text-primary scale-110"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-1 rounded-lg transition-colors",
              active && "bg-primary/10"
            )}>
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              active ? "opacity-100" : "opacity-60"
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
