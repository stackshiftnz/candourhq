"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useToast } from "@/lib/hooks/useToast";
import { getWordCount } from "@/lib/utils/word-count";
import type { Database } from "@/types/database";
import { 
  Plus, 
  ChevronRight, 
  User, 
  Globe, 
  Zap, 
  ShieldCheck,
  Search,
  Settings2,
  Trash2,
  CreditCard,
  Users,
  Bell,
  CircleCheck,
  AlertTriangle,
  History,
  Sparkles,
  Pencil,
  ArrowLeft,
  Save,
  MessageSquare,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrandProfile = Database["public"]["Tables"]["brand_profiles"]["Row"];
type Tone = "formal" | "conversational" | "technical" | "warm" | "direct";
type LangVariant = "en-US" | "en-GB";

interface NavProfile {
  id: string;
  name: string;
  is_default: boolean;
}

interface Props {
  profile: BrandProfile;
  allProfiles: NavProfile[];
}

// ---------------------------------------------------------------------------
// Static data (matches onboarding patterns)
// ---------------------------------------------------------------------------

const LANGUAGE_OPTIONS: Array<{
  value: LangVariant;
  flag: string;
  name: string;
  sub: string;
}> = [
  {
    value: "en-US",
    flag: "🇺🇸",
    name: "US English",
    sub: "American spelling. Color, organize, analyze.",
  },
  {
    value: "en-GB",
    flag: "🇬🇧",
    name: "British English",
    sub: "UK spelling. Colour, organise, analyse.",
  },
];

const TONE_OPTIONS: Array<{
  value: Tone;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "formal",
    label: "Formal",
    description: "Measured, professional, precise.",
    icon: <ShieldCheck size={14} />
  },
  {
    value: "conversational",
    label: "Conversational",
    description: "Friendly and direct.",
    icon: <MessageSquare size={14} />
  },
  {
    value: "technical",
    label: "Technical",
    description: "Precise and expert-led.",
    icon: <Settings2 size={14} />
  },
  {
    value: "warm",
    label: "Warm",
    description: "Human, empathetic, personal.",
    icon: <Sparkles size={14} />
  },
  {
    value: "direct",
    label: "Direct",
    description: "Short sentences, clear takeaways.",
    icon: <Zap size={14} />
  },
];

const NAV_ACCOUNT_LINKS = [
  { label: "Plan and billing", href: "/settings/billing", icon: <CreditCard size={14} /> },
  { label: "Team members", href: "/settings/team", icon: <Users size={14} /> },
  { label: "Notifications", href: "/settings/notifications", icon: <Bell size={14} /> },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-2">
      {children}
    </p>
  );
}

function SectionDivider() {
  return <div className="border-t border-border/50" />;
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function BrandProfileEditorClient({ profile, allProfiles }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // ---- Form state ----
  const [name, setName] = useState(profile.name);
  const [language, setLanguage] = useState<LangVariant>(
    (profile.language_variant as LangVariant) || "en-US"
  );
  const [tone, setTone] = useState<Tone>((profile.tone as Tone) || "conversational");
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(
    profile.banned_phrases ?? []
  );
  const [approvedPhrases, setApprovedPhrases] = useState<string[]>(
    profile.approved_phrases ?? []
  );
  const [writingExamples, setWritingExamples] = useState<string[]>(
    profile.writing_examples ?? []
  );

  // ---- UI state ----
  const [bannedInput, setBannedInput] = useState("");
  const [approvedInput, setApprovedInput] = useState("");
  const [showAddExample, setShowAddExample] = useState(false);
  const [newExample, setNewExample] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();

  // ---- Reset when profile changes (nav between profiles) ----
  useEffect(() => {
    setName(profile.name);
    setLanguage((profile.language_variant as LangVariant) || "en-US");
    setTone((profile.tone as Tone) || "conversational");
    setBannedPhrases(profile.banned_phrases ?? []);
    setApprovedPhrases(profile.approved_phrases ?? []);
    setWritingExamples(profile.writing_examples ?? []);
    setBannedInput("");
    setApprovedInput("");
    setNewExample("");
    setShowAddExample(false);
    setIsDirty(false);
  }, [profile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- beforeunload guard ----
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ---- Helpers ----
  const markDirty = () => setIsDirty(true);

  // ---- Save ----
  const { execute: handleSave, loading: isSaving } = useAsyncAction(
    async () => {
      const { error } = await supabase
        .from("brand_profiles")
        .update({
          name,
          language_variant: language,
          tone,
          banned_phrases: bannedPhrases,
          approved_phrases: approvedPhrases,
          writing_examples: writingExamples,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        toast("Save failed. Please try again.", "error");
      } else {
        setIsDirty(false);
        toast("Profile saved.", "success");
      }
    },
    {
      onTimeout: () => {
        toast("Save is taking longer than expected. Please try again.", "error");
      },
    }
  );

  // ---- New profile ----
  const { execute: handleNewProfile, loading: isCreatingProfile } = useAsyncAction(
    async () => {
      const { data, error } = await supabase
        .from("brand_profiles")
        .insert({
          user_id: profile.user_id,
          name: "New profile",
          language_variant: "en-US",
          tone: "conversational",
          is_default: false,
          banned_phrases: [
            "leverage",
            "cutting-edge",
            "synergies",
            "going forward",
            "circle back",
            "deep dive",
          ],
          approved_phrases: [],
          writing_examples: [],
        })
        .select("id")
        .single();

      if (!error && data) {
        router.push(`/settings/brand/${data.id}`);
      } else {
        toast("Failed to create profile. Please try again.", "error");
      }
    },
    {
      onTimeout: () => {
        toast("Profile creation is taking longer than expected.", "error");
      }
    }
  );

  // ---- Phrase helpers ----
  function addBannedPhrase() {
    const val = bannedInput.trim();
    if (!val || bannedPhrases.includes(val)) return;
    setBannedPhrases((prev) => [...prev, val]);
    setBannedInput("");
    markDirty();
  }

  function addApprovedPhrase() {
    const val = approvedInput.trim();
    if (!val || approvedPhrases.includes(val)) return;
    setApprovedPhrases((prev) => [...prev, val]);
    setApprovedInput("");
    markDirty();
  }

  function addExample() {
    const val = newExample.trim();
    if (!val || writingExamples.length >= 5) return;
    setWritingExamples((prev) => [...prev, val]);
    setNewExample("");
    setShowAddExample(false);
    markDirty();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background selection:bg-primary/20">
      {/* ================================================================
          LEFT NAV — Desktop (240px sidebar)
          ================================================================ */}
      <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 border-r border-border bg-muted/20 py-8 overflow-y-auto custom-scrollbar">
        {/* Brand profiles section */}
        <div className="px-6 mb-4">
          <SectionLabel>Identity Matrices</SectionLabel>
        </div>
        <nav className="mb-8 px-3 space-y-1">
          {allProfiles.map((p) => {
            const active = p.id === profile.id;
            return (
              <Link
                key={p.id}
                href={`/settings/brand/${p.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-[12px] font-bold transition-all duration-300 rounded-xl group",
                  active
                    ? "text-foreground bg-background border border-border shadow-xl shadow-black/5"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                )}
              >
                <div className={cn(
                   "w-2 h-2 rounded-full transition-all",
                   active ? "bg-primary scale-100" : "bg-muted-foreground/20 scale-50 group-hover:scale-75"
                )} />
                <span className="truncate">{p.name}</span>
                {p.is_default && (
                   <ShieldCheck size={10} className={cn("ml-auto", active ? "text-primary" : "text-muted-foreground/30")} />
                )}
              </Link>
            );
          })}
          <button
            onClick={handleNewProfile}
            disabled={isCreatingProfile}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-bold text-muted-foreground/40 hover:text-primary transition-all disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={3} className="ml-0.5" />
            <span>{isCreatingProfile ? "Deploying…" : "New Matrix"}</span>
          </button>
        </nav>

        {/* Account section */}
        <div className="px-6 mb-4 mt-4">
          <SectionLabel>Nexus Nodes</SectionLabel>
        </div>
        <nav className="px-3 space-y-1">
          {NAV_ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-bold text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-all rounded-xl"
            >
              <div className="w-2 opacity-50">{link.icon}</div>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* ================================================================
          MOBILE NAV — horizontal scrollable pill row
          ================================================================ */}
      <div className="lg:hidden flex-shrink-0 border-b border-border bg-muted/40 backdrop-blur-xl">
        <div className="flex overflow-x-auto gap-3 px-4 py-4 no-scrollbar">
          {allProfiles.map((p) => {
            const active = p.id === profile.id;
            return (
              <Link
                key={p.id}
                href={`/settings/brand/${p.id}`}
                className={cn(
                  "flex-shrink-0 h-10 px-5 text-[10px] font-bold rounded-2xl transition-all flex items-center justify-center whitespace-nowrap border",
                  active
                    ? "bg-foreground text-background border-foreground shadow-lg shadow-black/10"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {p.name}
              </Link>
            );
          })}
            <button
              onClick={handleNewProfile}
              disabled={isCreatingProfile}
              className="flex-shrink-0 h-10 px-5 text-[10px] font-bold rounded-2xl border border-dashed border-border text-muted-foreground/40 whitespace-nowrap disabled:opacity-50"
            >
              + New Matrix
            </button>
        </div>
      </div>

      {/* ================================================================
          RIGHT PANEL — Settings form
          ================================================================ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[800px] px-8 lg:px-12 py-10 space-y-12 pb-32 lg:pb-12">
          {/* Heading */}
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <Link href="/settings/brand" className="lg:hidden p-2 rounded-full border border-border bg-background">
                    <ArrowLeft size={16} />
                 </Link>
                 <h1 className="text-3xl font-bold text-foreground tracking-tight">{name}</h1>
              </div>
              <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed max-w-lg">
                Calibrate the linguistic vectors and stylistic constraints for this specific identity matrix. Updates synchronize immediately.
              </p>
            </div>
            {isDirty && (
               <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary animate-pulse">
                  <Zap size={12} fill="currentColor" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Modified</span>
               </div>
            )}
          </div>

          <SectionDivider />

          {/* ---- Profile name ---- */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/40">
                  <Pencil size={14} />
               </div>
               <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Registry Identity</h3>
            </div>
            
            <div className="max-w-md">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  markDirty();
                }}
                className="h-14 px-6 text-base font-bold rounded-[20px] bg-muted/20 border-border/50 focus:bg-background transition-all"
                placeholder="e.g. Agency Client — Smith & Co"
              />
            </div>
          </section>

          <SectionDivider />

          {/* ---- Language variant ---- */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/40">
                  <Globe size={14} />
               </div>
               <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Linguistic Variant</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LANGUAGE_OPTIONS.map(({ value, flag, name: langName, sub }) => {
                const selected = language === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setLanguage(value);
                      markDirty();
                    }}
                    className={cn(
                      "flex flex-col items-start gap-3 rounded-[28px] p-6 text-left transition-all duration-300 border group",
                      selected
                        ? "border-primary bg-primary/5 shadow-xl shadow-primary/5"
                        : "border-border hover:border-primary/30 bg-muted/10"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                       <span style={{ fontSize: 24 }} aria-hidden="true" className="group-hover:scale-110 transition-transform">
                         {flag}
                       </span>
                       {selected && <CircleCheck size={16} className="text-primary" />}
                    </div>
                    <div>
                       <span className={cn(
                         "text-sm font-bold uppercase tracking-tight block mb-1",
                         selected ? "text-primary" : "text-foreground"
                       )}>
                         {langName}
                       </span>
                       <span className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed block overflow-hidden">
                         {sub}
                       </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <SectionDivider />

          {/* ---- Tone ---- */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/40">
                     <Zap size={14} />
                  </div>
                  <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Tone Synthesis</h3>
               </div>
               <Badge variant="neutral" size="sm" className="opacity-40">Affects Sentence Structure</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TONE_OPTIONS.map(({ value, label, description, icon }) => {
                const selected = tone === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setTone(value);
                      markDirty();
                    }}
                    className={cn(
                      "flex flex-col items-start gap-4 rounded-[28px] p-6 text-left transition-all duration-300 border group",
                      selected
                        ? "border-primary bg-primary/5 shadow-xl shadow-primary/5"
                        : "border-border hover:border-primary/30 bg-muted/10 hover:-translate-y-1"
                    )}
                  >
                    <div className={cn(
                       "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                       selected ? "bg-primary text-background" : "bg-muted text-muted-foreground/40 group-hover:text-primary group-hover:bg-primary/20"
                    )}>
                       {icon}
                    </div>
                    <div>
                       <span className={cn(
                         "text-sm font-bold uppercase tracking-tight block mb-1",
                         selected ? "text-primary" : "text-foreground"
                       )}>
                         {label}
                       </span>
                       <span className="text-[11px] font-medium text-muted-foreground/60 leading-tight block">
                         {description}
                       </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <SectionDivider />

          {/* ---- Banned phrases ---- */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <AlertTriangle size={14} />
               </div>
               <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Linguistic Suppression</h3>
            </div>
            
            <p className="text-[12px] font-medium text-muted-foreground/60 leading-relaxed max-w-lg">
              Defined vocabulary vectors that will be systematically flagged and neutralized during clean-up.
            </p>

            <div className="flex items-center gap-3 max-w-md">
              <div className="relative flex-1">
                 <Input
                   type="text"
                   value={bannedInput}
                   onChange={(e) => setBannedInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === "Enter") {
                       e.preventDefault();
                       addBannedPhrase();
                     }
                   }}
                   placeholder="Suppress phrase..."
                   className="h-14 px-6 text-sm font-bold rounded-[22px] bg-muted/20 border-border/50 focus:bg-background transition-all pr-12"
                 />
                 <Search size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
              </div>
              <Button
                variant="primary"
                className="h-14 w-14 rounded-full p-0 flex items-center justify-center bg-accent text-white hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20 font-bold"
                onClick={addBannedPhrase}
                disabled={!bannedInput.trim()}
              >
                <Plus size={20} strokeWidth={3} />
              </Button>
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-3">
              {bannedPhrases.map((phrase) => (
                <div
                  key={phrase}
                  className="group/pill bg-accent/10 text-accent border border-accent/20 rounded-full text-[10px] font-bold uppercase tracking-widest px-4 py-2 flex items-center gap-2 hover:bg-accent hover:text-white transition-all cursor-default"
                >
                  {phrase}
                  <button
                    type="button"
                    onClick={() => {
                      setBannedPhrases((prev) =>
                        prev.filter((p) => p !== phrase)
                      );
                      markDirty();
                    }}
                    className="p-1 rounded-full hover:bg-white/20 transition-colors"
                    aria-label={`Remove ${phrase}`}
                  >
                    <Trash2 size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <SectionDivider />

          {/* ---- Approved phrases ---- */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                  <ShieldCheck size={14} />
               </div>
               <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Vocabulary Preservation</h3>
            </div>

            <p className="text-[12px] font-medium text-muted-foreground/60 leading-relaxed max-w-lg">
              Immutable brand terms and preferred technical nomenclature that will be protected during the clean-up pass.
            </p>

            <div className="flex items-center gap-3 max-w-md">
              <div className="relative flex-1">
                 <Input
                    type="text"
                    value={approvedInput}
                    onChange={(e) => setApprovedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addApprovedPhrase();
                      }
                    }}
                    placeholder="Preserve phrase..."
                    className="h-14 px-6 text-sm font-bold rounded-[22px] bg-muted/20 border-border/50 focus:bg-background transition-all pr-12"
                 />
                 <CircleCheck size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
              </div>
              <Button
                variant="primary"
                className="h-14 w-14 rounded-full p-0 flex items-center justify-center bg-green-500 text-white hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-500/20 font-bold"
                onClick={addApprovedPhrase}
                disabled={!approvedInput.trim()}
              >
                <Plus size={20} strokeWidth={3} />
              </Button>
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-3">
              {approvedPhrases.map((phrase) => (
                <div
                  key={phrase}
                  className="group/pill bg-green-500/10 text-green-600 border border-green-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest px-4 py-2 flex items-center gap-2 hover:bg-green-500 hover:text-white transition-all cursor-default"
                >
                  {phrase}
                  <button
                    type="button"
                    onClick={() => {
                      setApprovedPhrases((prev) =>
                        prev.filter((p) => p !== phrase)
                      );
                      markDirty();
                    }}
                    className="p-1 rounded-full hover:bg-white/20 transition-colors"
                    aria-label={`Remove ${phrase}`}
                  >
                    <Trash2 size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <SectionDivider />

          {/* ---- Writing examples ---- */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/40">
                     <FileText size={14} />
                  </div>
                  <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Voice Samples</h3>
               </div>
               <Badge variant="neutral" size="sm" className="opacity-40">{writingExamples.length} of 5 Slots Filled</Badge>
            </div>

            <p className="text-[12px] font-medium text-muted-foreground/60 leading-relaxed max-w-lg">
               Providing stylistic samples allows the identity matrix to learn and replicate specific linguistic patterns. Samples are processed into private vectors.
            </p>
            
            {/* Existing examples */}
            {writingExamples.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {writingExamples.map((example, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-6 bg-muted/10 border border-border rounded-[32px] group"
                  >
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-2xl bg-background border border-border flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">Sample Vector #{idx + 1}</span>
                          <span className="text-[10px] font-medium text-muted-foreground/60">{getWordCount(example)} Vectors Extracted</span>
                       </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setWritingExamples((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                        markDirty();
                      }}
                      className="text-muted-foreground/40 hover:text-accent hover:bg-accent/10 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-border rounded-[48px] bg-muted/5 opacity-50">
                 <FileText size={32} className="text-muted-foreground/20 mb-4" />
                 <p className="text-[11px] font-bold uppercase text-center text-muted-foreground tracking-widest">No stylistic samples linked</p>
              </div>
            )}

            {/* Add example — inline form */}
            {writingExamples.length < 5 && (
              <div className="pt-2">
                {showAddExample ? (
                  <div className="p-8 bg-muted/10 border border-border rounded-[40px] space-y-6 animate-in zoom-in-95 duration-300">
                    <textarea
                      value={newExample}
                      onChange={(e) => setNewExample(e.target.value)}
                      placeholder="Paste high-performing writing sample here..."
                      rows={8}
                      className="w-full p-6 text-sm font-medium bg-background border border-border rounded-[28px] placeholder-muted-foreground/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all resize-none custom-scrollbar"
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        className="h-12 px-8 rounded-full font-bold text-[10px] bg-foreground text-background"
                        onClick={addExample}
                        disabled={!newExample.trim()}
                      >
                        <CircleCheck size={14} className="mr-2" strokeWidth={3} />
                        Link Sample
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-12 px-8 rounded-full font-bold text-[10px] text-muted-foreground"
                        onClick={() => {
                          setShowAddExample(false);
                          setNewExample("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddExample(true)}
                    className="w-full h-20 flex items-center justify-center gap-3 rounded-[32px] border-2 border-dashed border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-all group"
                  >
                    <Plus size={16} strokeWidth={3} className="text-muted-foreground/20 group-hover:text-primary/40 group-hover:scale-110 transition-all" />
                    Initialize and link new sample vector
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Desktop Save Area */}
          <div className="hidden lg:flex items-center justify-between pt-12 border-t border-border">
            <div className="flex flex-col gap-1">
               <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Matrix Synchronization</span>
               <p className="text-[11px] text-muted-foreground/40 font-medium">New documents will inherit these parameters instantly.</p>
            </div>
            <Button
              className="h-14 px-10 rounded-[28px] font-bold text-xs bg-foreground text-background hover:scale-[1.02] transition-all shadow-2xl shadow-black/20"
              onClick={handleSave}
              loading={isSaving}
              disabled={!isDirty}
            >
              <Save size={16} className="mr-2" strokeWidth={3} />
              Synchronize Registry
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Save Footer */}
      <div className={cn(
         "lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/80 backdrop-blur-2xl border-t border-border p-4 transition-transform duration-500",
         isDirty ? "translate-y-0" : "translate-y-full"
      )}>
        <Button
          className="w-full h-14 rounded-2xl font-bold bg-foreground text-background shadow-2xl shadow-black/20"
          onClick={handleSave}
          loading={isSaving}
        >
          <Save size={16} className="mr-2" strokeWidth={3} />
          Synchronize Matrix
        </Button>
      </div>

    </div>
  );
}
