"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function MobileHeader() {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/signin");
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 dark:bg-gray-950 dark:border-gray-900 z-50 flex items-center justify-between px-4 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-full bg-white border-[3px] border-gray-900" />
        </div>
        <span className="font-bold text-[16px] tracking-tight">Candour</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-9 h-9 rounded-full bg-brand-yellow flex items-center justify-center text-brand-dark font-bold text-xs"
        >
          M
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 z-20">
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
