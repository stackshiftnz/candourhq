"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "New document", href: "/new" },
  { label: "History", href: "/history" },
  { label: "Brand profiles", href: "/settings/brand" },
  { label: "Settings", href: "/settings/team" },
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
      {/* Wordmark / collapse toggle row */}
      <div className={`pt-6 pb-4 flex items-center ${isCollapsed ? "flex-col gap-3 px-3" : "px-6 gap-4"}`}>
        {!isCollapsed && (
          <Link href="/dashboard" className="block flex-1 min-w-0">
            <Image
              src="/logo.png"
              alt="Candour HQ"
              width={120}
              height={120}
              className="h-auto w-20 dark:invert-0"
              priority
            />
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
        </button>
        {isCollapsed && (
          <Link href="/dashboard" className="block">
            <Image
              src="/logo.png"
              alt="Candour HQ"
              width={32}
              height={32}
              className="h-8 w-8 object-contain dark:invert-0"
              priority
            />
          </Link>
        )}
      </div>

      {/* Brand name row (expanded only) */}
      {!isCollapsed && (
        <div className="px-7 pb-2">
          <p className="text-[12px] font-medium text-gray-400 truncate">
            {activeBrandName}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 mt-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={[
                    "flex items-center rounded-xl transition-all duration-200",
                    isCollapsed ? "justify-center w-10 h-10 mx-auto" : "px-4 py-3 gap-2",
                    "text-[15px] font-medium",
                    active
                      ? "text-brand-dark bg-brand-yellow shadow-sm dark:bg-brand-yellow/90"
                      : "text-gray-500 hover:text-brand-dark hover:bg-[#f2f0ea] dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {isCollapsed ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${active ? "bg-brand-dark" : "bg-gray-400"}`}
                    />
                  ) : (
                    item.label
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Collapsed sign-out */}
      {isCollapsed && (
        <div className="p-2 mt-auto flex flex-col items-center gap-2">
          <button
            onClick={handleSignOut}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
            title="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
