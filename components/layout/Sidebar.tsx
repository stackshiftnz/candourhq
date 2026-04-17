"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/signin");
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] flex flex-col bg-brand-cream border-none dark:bg-brand-dark">
      {/* Wordmark */}
      <div className="px-6 pt-8 pb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-dark flex items-center justify-center flex-shrink-0">
          <div className="w-4 h-4 rounded-full bg-white border-4 border-brand-dark box-border shadow-[0_0_0_2px_#181818]" style={{ boxShadow: 'inset 0 0 0 2px white' }} />
        </div>
        <div>
          <p className="text-[18px] font-bold text-brand-dark tracking-tight leading-none dark:text-white">
            Candour
          </p>
          <p className="text-[12px] font-medium text-gray-400 mt-1 truncate">
            {activeBrandName}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "flex items-center px-4 py-3 text-[15px] font-medium rounded-xl transition-all duration-200",
                    active
                      ? "text-brand-dark bg-brand-yellow shadow-sm dark:bg-brand-yellow/90"
                      : "text-gray-500 hover:text-brand-dark hover:bg-[#f2f0ea] dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
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
    </aside>
  );
}
