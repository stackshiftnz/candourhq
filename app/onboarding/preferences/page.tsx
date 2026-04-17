"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding, type Tone } from "@/lib/context/OnboardingContext";
import { Button } from "@/components/ui/Button";

// ─── Data ─────────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS: Array<{
  value: "en-US" | "en-GB";
  flag: string;
  name: string;
  sub: string;
}> = [
  {
    value: "en-US",
    flag: "🇺🇸",
    name: "US English",
    sub: "American spelling and conventions. Color, organize, analyze.",
  },
  {
    value: "en-GB",
    flag: "🇬🇧",
    name: "British English",
    sub: "UK spelling and conventions. Colour, organise, analyse.",
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
    description:
      "Measured, professional, precise. Good for reports and board-level communications.",
  },
  {
    value: "conversational",
    label: "Conversational",
    description:
      "Friendly and direct. Works well for blogs, emails, and most marketing content.",
  },
  {
    value: "technical",
    label: "Technical",
    description:
      "Precise and expert-led. Keeps terminology intact for specialist audiences.",
  },
  {
    value: "warm",
    label: "Warm",
    description:
      "Human, empathetic, personal. Strong for customer-facing and community content.",
  },
  {
    value: "direct",
    label: "Direct",
    description:
      "Short sentences, clear takeaways, zero hedging. Suits executive comms and proposals.",
  },
];

const TONE_PREVIEW: Record<Tone, { sentence: string; note: string }> = {
  formal: {
    sentence:
      "We have reviewed the available data and identified three areas warranting attention. The following recommendations are offered for consideration.",
    note: "Best for internal reports, executive briefings, and formal communications.",
  },
  conversational: {
    sentence:
      "We looked at the data and found three things worth acting on. Here's what we'd do first.",
    note: "A strong default that works across most content types.",
  },
  technical: {
    sentence:
      "Analysis of the dataset surfaced three high-signal findings. Recommended interventions are ranked by impact-to-effort ratio below.",
    note: "Preserves specialist terminology for expert and developer audiences.",
  },
  warm: {
    sentence:
      "Going through the data, we found something that we think will really help. Let us walk you through it.",
    note: "Ideal for customer stories, community updates, and support content.",
  },
  direct: {
    sentence: "Three findings. Here is what to do.",
    note: "Perfect for executive summaries, proposals, and time-sensitive comms.",
  },
};

const SPELLING_PREVIEW: Record<"en-US" | "en-GB", string> = {
  "en-US": "The team will analyze how this affects the program going forward.",
  "en-GB":
    "The team will analyse how this affects the programme going forward.",
};

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {children}
    </p>
  );
}

// ─── Preview panel (shared between desktop right column and mobile inline) ────

function TonePreviewCard({
  tone,
  lang,
}: {
  tone: Tone;
  lang: "en-US" | "en-GB";
}) {
  const { sentence, note } = TONE_PREVIEW[tone];
  return (
    <>
      {/* Tone preview */}
      <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-[12px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Same sentence — different tone
        </p>
        <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed italic">
          &ldquo;{sentence}&rdquo;
        </p>
        <p className="mt-2 text-[12px] text-gray-400 dark:text-gray-500 leading-relaxed">
          {note}
        </p>
      </div>

      {/* Spelling preview — desktop only (inside the panel it's always shown) */}
      <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-[12px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Spelling example
        </p>
        <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed italic">
          &ldquo;{SPELLING_PREVIEW[lang]}&rdquo;
        </p>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingStep2Page() {
  const router = useRouter();
  const { languageVariant, tone, setLanguageVariant, setTone } =
    useOnboarding();

  // Local state — pre-filled from context (back nav from step 3 restores choices).
  const [lang, setLang] = useState<"en-US" | "en-GB">(languageVariant);
  const [selectedTone, setSelectedTone] = useState<Tone>(tone);

  function handleNext() {
    setLanguageVariant(lang);
    setTone(selectedTone);
    router.push("/onboarding/save");
  }

  function handleBack() {
    router.back();
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 max-w-[960px]">
      {/* Two-column grid on desktop */}
      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-6">
          {/* Heading */}
          <div>
            <h1 className="text-[18px] font-medium text-gray-900 dark:text-white leading-snug">
              How should your content read?
            </h1>
            <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Two quick choices. Both can be changed any time in your brand
              settings, and overridden per document.
            </p>
          </div>

          {/* ── Language variant ── */}
          <div className="flex flex-col gap-3">
            <SectionLabel>English variant</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LANGUAGE_OPTIONS.map(({ value, flag, name, sub }) => {
                const selected = lang === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLang(value)}
                    className={[
                      "flex flex-col items-start gap-1.5 rounded-[10px] p-4 text-left transition-colors",
                      selected
                        ? "border-2 border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-900"
                        : "border border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span style={{ fontSize: 22 }} aria-hidden="true">
                      {flag}
                    </span>
                    <span
                      className={[
                        "text-[13px] text-gray-900 dark:text-white",
                        selected ? "font-medium" : "font-normal",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {name}
                    </span>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Tone ── */}
          <div className="flex flex-col gap-3">
            <SectionLabel>Tone</SectionLabel>
            {/*
              Desktop: 3-column grid, 6 slots (5 tones + placeholder)
              Mobile:  2-column grid, "Direct" spans full width in last row
            */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TONE_OPTIONS.map(({ value, label, description }) => {
                const selected = selectedTone === value;
                const isDirect = value === "direct";
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedTone(value)}
                    className={[
                      "flex flex-col items-start gap-1 rounded-[10px] p-3.5 text-left transition-colors",
                      // "Direct" spans 2 cols on mobile so it fills the last row
                      isDirect ? "sm:col-span-2 lg:col-span-1" : "",
                      selected
                        ? "border-2 border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-900"
                        : "border border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span
                      className={[
                        "text-[13px] text-gray-900 dark:text-white",
                        selected ? "font-medium" : "font-normal",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {label}
                    </span>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
                      {description}
                    </span>
                  </button>
                );
              })}

              {/* Placeholder — desktop only, 6th slot */}
              <div className="hidden lg:flex flex-col items-start justify-center rounded-[10px] border border-dashed border-gray-200 dark:border-gray-700 p-3.5">
                <span className="text-[12px] text-gray-400 dark:text-gray-500">
                  More options in full setup
                </span>
              </div>
            </div>
          </div>

          {/* ── Inline preview — mobile only, below tone grid ── */}
          <div className="flex flex-col gap-3 lg:hidden">
            <SectionLabel>Live preview</SectionLabel>
            <TonePreviewCard tone={selectedTone} lang={lang} />
          </div>
        </div>

        {/* ── Right column — desktop only ── */}
        <div className="hidden lg:flex flex-col gap-4">
          <SectionLabel>Live preview</SectionLabel>
          <TonePreviewCard tone={selectedTone} lang={lang} />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <Button variant="secondary" onClick={handleBack}>
          Back
        </Button>
        <Button variant="primary" onClick={handleNext}>
          Next — name your profile
        </Button>
      </div>
    </div>
  );
}
