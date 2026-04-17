"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useToast } from "@/lib/hooks/useToast";
import { getWordCount } from "@/lib/utils/word-count";
import type { Database } from "@/types/database";

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
}> = [
  {
    value: "formal",
    label: "Formal",
    description: "Measured, professional, precise.",
  },
  {
    value: "conversational",
    label: "Conversational",
    description: "Friendly and direct.",
  },
  {
    value: "technical",
    label: "Technical",
    description: "Precise and expert-led.",
  },
  {
    value: "warm",
    label: "Warm",
    description: "Human, empathetic, personal.",
  },
  {
    value: "direct",
    label: "Direct",
    description: "Short sentences, clear takeaways.",
  },
];

const NAV_ACCOUNT_LINKS = [
  { label: "Plan and billing", href: "/settings/billing" },
  { label: "Team members", href: "/settings/team" },
  { label: "Notifications", href: "/settings/notifications" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-gray-400">
      {children}
    </p>
  );
}

function SectionDivider() {
  return <div className="border-t border-gray-100" />;
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
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-white">
      {/* ================================================================
          LEFT NAV — Desktop (180px sidebar)
          ================================================================ */}
      <aside className="hidden lg:flex flex-col w-[180px] flex-shrink-0 border-r border-gray-100 bg-gray-50 py-4 overflow-y-auto">
        {/* Brand profiles section */}
        <div className="px-4 mb-2">
          <SectionLabel>Brand profiles</SectionLabel>
        </div>
        <nav className="mb-4">
          {allProfiles.map((p) => {
            const active = p.id === profile.id;
            return (
              <Link
                key={p.id}
                href={`/settings/brand/${p.id}`}
                className={[
                  "flex items-center px-4 py-2 text-[13px] transition-colors",
                  active
                    ? "font-medium text-gray-900 bg-white border-r-2 border-gray-900"
                    : "text-gray-400 hover:text-gray-600",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="truncate">{p.name}</span>
              </Link>
            );
          })}
          <button
            onClick={handleNewProfile}
            disabled={isCreatingProfile}
            className="w-full flex items-center px-4 py-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            {isCreatingProfile ? "Creating…" : "+ New profile"}
          </button>
        </nav>

        {/* Account section */}
        <div className="px-4 mb-2 mt-2">
          <SectionLabel>Account</SectionLabel>
        </div>
        <nav>
          {NAV_ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center px-4 py-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ================================================================
          MOBILE NAV — horizontal scrollable pill row
          ================================================================ */}
      <div className="lg:hidden flex-shrink-0 border-b border-gray-100 bg-gray-50">
        <div className="flex overflow-x-auto gap-2 px-4 py-2.5 no-scrollbar">
          {allProfiles.map((p) => {
            const active = p.id === profile.id;
            return (
              <Link
                key={p.id}
                href={`/settings/brand/${p.id}`}
                className={[
                  "flex-shrink-0 h-11 px-4 text-xs font-medium rounded-full transition-colors flex items-center justify-center whitespace-nowrap",
                  active
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 text-gray-500 hover:bg-gray-50",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {p.name}
              </Link>
            );
          })}
            <button
              onClick={handleNewProfile}
              disabled={isCreatingProfile}
              className="flex-shrink-0 h-11 px-4 text-xs font-medium rounded-full border border-dashed border-gray-300 text-gray-400 whitespace-nowrap disabled:opacity-50"
            >
              + New
            </button>
        </div>
      </div>

      {/* ================================================================
          RIGHT PANEL — Settings form
          ================================================================ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-6 lg:px-8 py-8 space-y-8 pb-24 lg:pb-8">
          {/* Heading */}
          <div>
            <h1 className="text-[17px] font-medium text-gray-900">{name}</h1>
            <p className="text-[12px] text-gray-400 mt-1">
              These settings shape every diagnosis and clean-up using this
              profile. Changes apply to new documents immediately.
            </p>
          </div>

          <SectionDivider />

          {/* ---- Profile name ---- */}
          <section className="space-y-3">
            <h3 className="text-[13px] font-medium text-gray-900">
              Profile name
            </h3>
            <div className="max-w-sm">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. Agency client — Smith & Co"
              />
            </div>
          </section>

          <SectionDivider />

          {/* ---- Language variant ---- */}
          <section className="space-y-3">
            <h3 className="text-[13px] font-medium text-gray-900">
              Language variant
            </h3>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
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
                    className={[
                      "flex flex-col items-start gap-1 rounded-[10px] p-3.5 text-left transition-colors",
                      selected
                        ? "border-2 border-gray-900 bg-gray-50"
                        : "border border-gray-200 hover:border-gray-300",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span style={{ fontSize: 18 }} aria-hidden="true">
                      {flag}
                    </span>
                    <span
                      className={[
                        "text-[13px] text-gray-900",
                        selected ? "font-medium" : "font-normal",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {langName}
                    </span>
                    <span className="text-[12px] text-gray-500 leading-relaxed">
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <SectionDivider />

          {/* ---- Tone ---- */}
          <section className="space-y-3">
            <h3 className="text-[13px] font-medium text-gray-900">Tone</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {TONE_OPTIONS.map(({ value, label, description }) => {
                const selected = tone === value;
                const isDirect = value === "direct";
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setTone(value);
                      markDirty();
                    }}
                    className={[
                      "flex flex-col items-start gap-1 rounded-[10px] p-3.5 text-left transition-colors",
                      isDirect ? "col-span-2 lg:col-span-1" : "",
                      selected
                        ? "border-2 border-gray-900 bg-gray-50"
                        : "border border-gray-200 hover:border-gray-300",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span
                      className={[
                        "text-[13px] text-gray-900",
                        selected ? "font-medium" : "font-normal",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {label}
                    </span>
                    <span className="text-[12px] text-gray-500 leading-relaxed">
                      {description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <SectionDivider />

          {/* ---- Banned phrases ---- */}
          <section className="space-y-3">
            <div>
              <h3 className="text-[13px] font-medium text-gray-900">
                Banned phrases
              </h3>
              <p className="text-[12px] text-gray-400 mt-0.5">
                These phrases will be flagged and replaced in every document
                using this profile.
              </p>
            </div>

            {/* Input row */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={bannedInput}
                onChange={(e) => setBannedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBannedPhrase();
                  }
                }}
                placeholder="Add a phrase…"
                className="flex-1 h-11 px-3 text-sm border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              />
              <Button
                variant="secondary"
                size="md"
                className="h-11"
                onClick={addBannedPhrase}
                disabled={!bannedInput.trim()}
              >
                Add
              </Button>
            </div>

            {/* Pills */}
            {bannedPhrases.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {bannedPhrases.map((phrase) => (
                  <span
                    key={phrase}
                    className="bg-red-100 text-red-800 rounded-full text-xs px-3 py-1 inline-flex items-center gap-1"
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
                      className="ml-0.5 text-red-500 hover:text-red-800 transition-colors leading-none"
                      aria-label={`Remove ${phrase}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <SectionDivider />

          {/* ---- Approved phrases ---- */}
          <section className="space-y-3">
            <div>
              <h3 className="text-[13px] font-medium text-gray-900">
                Approved phrases
              </h3>
              <p className="text-[12px] text-gray-400 mt-0.5">
                Product names, brand terms, and preferred vocabulary preserved
                during clean-up.
              </p>
            </div>

            {/* Input row */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={approvedInput}
                onChange={(e) => setApprovedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addApprovedPhrase();
                  }
                }}
                placeholder="Add a phrase…"
                className="flex-1 h-11 px-3 text-sm border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              />
              <Button
                variant="secondary"
                size="md"
                className="h-11"
                onClick={addApprovedPhrase}
                disabled={!approvedInput.trim()}
              >
                Add
              </Button>
            </div>

            {/* Pills */}
            {approvedPhrases.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {approvedPhrases.map((phrase) => (
                  <span
                    key={phrase}
                    className="bg-green-100 text-green-800 rounded-full text-xs px-3 py-1 inline-flex items-center gap-1"
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
                      className="ml-0.5 text-green-600 hover:text-green-900 transition-colors leading-none"
                      aria-label={`Remove ${phrase}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <SectionDivider />

          {/* ---- Writing examples ---- */}
          <section className="space-y-3">
            <div>
              <h3 className="text-[13px] font-medium text-gray-900">
                Writing examples
              </h3>
              <p className="text-[12px] text-gray-400 mt-0.5">
                Private to your account. Help Candour learn your voice.
              </p>
            </div>
            
            {/* Existing examples */}
            {writingExamples.length > 0 ? (
              <ul className="space-y-2">
                {writingExamples.map((example, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-[12px] text-gray-500">
                      Example {idx + 1} · {getWordCount(example)} words
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setWritingExamples((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                        markDirty();
                      }}
                      className="text-gray-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-gray-400 py-3">
                No writing examples added yet. Examples help Candour learn your voice.
              </p>
            )}

            {/* Add example — inline form */}
            {writingExamples.length < 5 && (
              <>
                {showAddExample ? (
                  <div className="space-y-2">
                    <textarea
                      value={newExample}
                      onChange={(e) => setNewExample(e.target.value)}
                      placeholder="Paste a writing example here…"
                      rows={5}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={addExample}
                        disabled={!newExample.trim()}
                      >
                        Add example
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
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
                    className="h-11 flex items-center text-[13px] text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    + Add another example
                  </button>
                )}
              </>
            )}

            {writingExamples.length === 5 && (
              <p className="text-[12px] text-gray-400">
                Maximum 5 examples reached.
              </p>
            )}
          </section>

          {/* ---- Save row — desktop ---- */}
          <div className="hidden lg:flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-[12px] text-gray-400 max-w-xs">
              Changes apply to new documents immediately. Previously analysed
              documents are unaffected.
            </p>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={isSaving}
            >
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {/* ---- Save row — mobile sticky footer ---- */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 py-3">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isSaving}
          className="w-full"
        >
          Save changes
        </Button>
      </div>

    </div>
  );
}
