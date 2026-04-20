"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  Plus, 
  ChevronRight, 
  User, 
  Globe, 
  Zap, 
  ShieldCheck,
  Search,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";

type BrandProfile = {
  id: string;
  name: string;
  language_variant: string;
  tone: string;
  is_default: boolean;
};

const LANG_LABELS: Record<string, string> = {
  "en-US": "US English",
  "en-GB": "British English",
};

const DEFAULT_BANNED_PHRASES = [
  "leverage",
  "cutting-edge",
  "synergies",
  "going forward",
  "circle back",
  "deep dive",
];

export default function BrandProfilesListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase
        .from("brand_profiles")
        .select("id, name, language_variant, tone, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          setProfiles(data ?? []);
          setLoading(false);
        });
    });
  }, []);

  async function handleNewProfile() {
    if (creating || !userId) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert({
        user_id: userId,
        name: "New profile",
        language_variant: "en-US",
        tone: "conversational",
        is_default: false,
        banned_phrases: DEFAULT_BANNED_PHRASES,
        approved_phrases: [],
        writing_examples: [],
      })
      .select("id")
      .single();

    setCreating(false);
    if (!error && data) {
      router.push(`/settings/brand/${data.id}`);
    }
  }

  return (
    <div className="flex flex-col h-full bg-background selection:bg-primary/20">
      {/* Premium Sticky Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-8 h-20 border-b border-border bg-background/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
             <Settings2 size={20} />
          </div>
          <div className="flex flex-col">
              <h1 className="text-sm font-bold text-foreground">
                Identity Matrices
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                System Calibration Registry
              </p>
          </div>
        </div>
        
        <Button
          variant="primary"
          className="rounded-2xl font-bold h-12 h-10 px-6 bg-foreground text-background hover:scale-[1.02] transition-all shadow-xl shadow-black/10"
          onClick={handleNewProfile}
          loading={creating}
        >
          <Plus size={16} className="mr-2" strokeWidth={3} />
          Deploy New Matrix
        </Button>
      </div>

      <div className="flex-1 px-8 py-10 max-w-4xl mx-auto w-full">
        <div className="mb-8 px-2">
           <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">Available Brand Profiles</h2>
           <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed">
             Select a profile to calibrate its linguistic vectors, tone constraints, and vocabulary preservation rules.
           </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-muted/30 border border-border/50 rounded-[32px] animate-pulse"
              />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-8 px-12 border-2 border-dashed border-border rounded-[48px] bg-muted/5">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground/20">
               <ShieldCheck size={48} />
            </div>
            <div className="text-center space-y-2">
               <p className="text-xl font-bold text-foreground tracking-tight">No profiles initialized</p>
               <p className="text-sm font-medium text-muted-foreground max-w-xs mx-auto opacity-60">
                 Your linguistic registry is empty. Initialize your first brand matrix to begin analysis.
               </p>
            </div>
            <Button
              className="h-14 px-10 rounded-[28px] font-bold bg-foreground text-background hover:scale-[1.02] transition-all shadow-2xl shadow-black/20"
              onClick={handleNewProfile}
              loading={creating}
            >
              Initialize matrix
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {profiles.map((profile) => (
              <Link
                key={profile.id}
                href={`/settings/brand/${profile.id}`}
                className="group relative bg-card border border-border rounded-[32px] p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 block overflow-hidden"
              >
                {/* Visual Flair */}
                <div className={cn(
                  "absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none",
                  profile.is_default ? "from-green-500" : "from-primary"
                )} />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-5 min-w-0">
                    <div className={cn(
                       "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform duration-500 group-hover:rotate-6",
                       profile.is_default ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-primary/10 border-primary/20 text-primary"
                    )}>
                       <User size={20} />
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {profile.name}
                        </span>
                        {profile.is_default && (
                          <div className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[9px] font-bold tracking-widest text-green-600 uppercase">
                            Primary
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground/60 transition-opacity group-hover:opacity-100">
                        <div className="flex items-center gap-1.5">
                           <Globe size={12} strokeWidth={3} />
                           <span className="text-[11px] font-bold uppercase tracking-widest">
                             {LANG_LABELS[profile.language_variant] ?? profile.language_variant}
                           </span>
                        </div>
                        <span className="opacity-20 text-[8px]">|</span>
                        <div className="flex items-center gap-1.5">
                           <Zap size={12} strokeWidth={3} />
                           <span className="text-[11px] font-bold uppercase tracking-widest">
                             {profile.tone} Tone
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Configure</span>
                     <ChevronRight size={16} className="text-primary" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="h-20" />
      </div>
    </div>
  );
}
