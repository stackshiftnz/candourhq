"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu, User } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

export function MobileHeader() {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/signin");
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-md border-b border-border z-50 flex items-center justify-between px-4 lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image 
          src="/logo-icon.png" 
          alt="Candour HQ" 
          width={32} 
          height={32} 
          className="h-8 w-8" 
          priority
        />
        <span className="font-bold tracking-tight text-foreground">Candour</span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shadow-sm active:scale-95 transition-transform"
          >
            <User size={16} />
          </button>

          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute right-0 mt-3 w-48 bg-card border border-border rounded-2xl shadow-2xl py-1 z-20 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-4 py-3 border-b border-border mb-1">
                  <p className="text-xs font-bold text-foreground">My Account</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-3 text-sm text-accent hover:bg-accent/10 flex items-center gap-3 transition-colors"
                >
                  <LogOut size={16} />
                  <span className="font-medium">Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
