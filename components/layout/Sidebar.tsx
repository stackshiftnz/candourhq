"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutDashboardIcon,
  FilePlusIcon,
  HistoryIcon,
  PaletteIcon,
  Settings2Icon,
  LogOutIcon,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",      href: "/dashboard",     icon: LayoutDashboardIcon },
  { label: "New document",   href: "/new",            icon: FilePlusIcon },
  { label: "History",        href: "/history",        icon: HistoryIcon },
  { label: "Brand profiles", href: "/settings/brand", icon: PaletteIcon },
  { label: "Settings",       href: "/settings/team",  icon: Settings2Icon },
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
    // intentionally run once on mount — supabase client is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      className={`sticky top-0 h-screen flex flex-col bg-brand-cream dark:bg-brand-dark overflow-hidden transition-all duration-200 ${
        isCollapsed ? "w-[56px]" : "w-[240px]"
      }`}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center shrink-0 ${isCollapsed ? "flex-col gap-3 px-3 pt-5 pb-3" : "px-5 pt-6 pb-4 gap-3"}`}>
        <Link href="/dashboard" className={`block shrink-0 ${isCollapsed ? "" : "flex-1 min-w-0"}`}>
          {isCollapsed ? (
            <Image
              src="/logo-icon.png"
              alt="Candour HQ"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
              priority
            />
          ) : (
            <Image
              src="/logo.png"
              alt="Candour HQ"
              width={120}
              height={120}
              className="h-auto w-20 dark:invert-0"
              priority
            />
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRightIcon size={15} /> : <ChevronLeftIcon size={15} />}
        </button>
      </div>

      {/* Brand name row (expanded only) */}
      {!isCollapsed && (
        <div className="px-6 pb-3">
          <p className="text-[12px] font-medium text-gray-400 truncate">{activeBrandName}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 mt-1">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={[
                    "flex items-center rounded-xl transition-all duration-200",
                    isCollapsed ? "justify-center w-10 h-10 mx-auto" : "px-4 py-2.5 gap-3",
                    "text-[14px] font-medium",
                    active
                      ? "text-brand-dark bg-brand-yellow shadow-sm dark:bg-brand-yellow/90"
                      : "text-gray-500 hover:text-brand-dark hover:bg-[#f2f0ea] dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Icon size={16} className="shrink-0" />
                  {!isCollapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — expanded */}
      {!isCollapsed && (
        <div className="p-4 mt-auto">
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-black/5 dark:bg-gray-900 dark:border-white/10">
            <div className="w-9 h-9 bg-brand-yellow rounded-full flex items-center justify-center text-brand-dark font-bold text-sm shrink-0">
              {activeBrandName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-brand-dark truncate dark:text-white">
                {activeBrandName}
              </p>
              <p className="text-[11px] font-medium text-brand-dark bg-brand-yellow px-2 py-0.5 rounded inline-block mt-0.5">
                Admin
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors dark:hover:bg-gray-800"
              title="Sign out"
            >
              <LogOutIcon size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Footer — collapsed */}
      {isCollapsed && (
        <div className="p-2 mt-auto flex flex-col items-center">
          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
            title="Sign out"
          >
            <LogOutIcon size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}
