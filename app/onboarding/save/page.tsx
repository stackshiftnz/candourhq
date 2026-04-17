"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding, type Tone } from "@/lib/context/OnboardingContext";
import { saveProfile } from "@/app/actions/onboarding";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_LABEL: Record<"en-US" | "en-GB", string> = {
  "en-US": "US English",
  "en-GB": "British English",
};

const TONE_LABEL: Record<Tone, string> = {
  formal: "Formal",
  conversational: "Conversational",
  technical: "Technical",
  warm: "Warm",
  direct: "Direct",
};

const WHAT_NEXT = [
  "We'll show you a pre-loaded piece of AI content already diagnosed against your new profile",
  "You'll see your first quality scores and exactly what Candour would change",
  "From there you can clean the sample or paste your own content straight away",
];

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  name,
  exampleCount,
  lang,
  tone,
}: {
  name: string;
  exampleCount: number;
  lang: "en-US" | "en-GB";
  tone: Tone;
}) {
  const displayName = name.trim() || "My brand";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header — updates live as user types */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <p className="text-[14px] font-medium text-gray-900 dark:text-white truncate">
          {displayName}
        </p>
        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
          Profile summary — ready to use
        </p>
      </div>

      {/* Summary rows */}
      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        <SummaryRow
          label="Writing examples"
          value={
            exampleCount === 0
              ? "None added"
              : `${exampleCount} added`
          }
          muted={exampleCount === 0}
        />
        <SummaryRow label="Language" value={LANG_LABEL[lang]} />
        <SummaryRow label="Tone" value={TONE_LABEL[tone]} />
        <SummaryRow
          label="Banned phrases"
          value="None yet — add in settings"
          muted
        />
        {/* Status row */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">
            Status
          </span>
          <Badge variant="success" size="sm">
            Ready
          </Badge>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span
        className={[
          "text-[12px]",
          muted
            ? "text-gray-400 dark:text-gray-600"
            : "text-gray-900 dark:text-gray-100 font-medium",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

// ─── What happens next card ───────────────────────────────────────────────────

function WhatHappensNextCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-3">
        What happens next
      </p>
      <ul className="flex flex-col gap-2.5">
        {WHAT_NEXT.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
              {item}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingStep3Page() {
  const router = useRouter();
  const { examples, languageVariant, tone, profileName, setProfileName } =
    useOnboarding();

  // Local state for the name input — pre-filled from context (back navigation).
  const [name, setName] = useState<string>(() => profileName);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const exampleCount = examples.filter((s) => s.trim().length > 0).length;

  function handleBack() {
    // Persist the typed name to context before navigating away.
    setProfileName(name);
    router.back();
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/signin");
        return;
      }

      const result = await saveProfile(user.id, {
        name: name.trim() || "My brand",
        languageVariant,
        tone,
        writingExamples: examples,
      });

      if (!result.success) {
        setSaveError("Something went wrong. Please try again.");
        setIsSaving(false);
        return;
      }

      router.push("/sample");
    } catch {
      setSaveError("Something went wrong. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      {/* Two-column grid on desktop */}
      <div className="lg:grid lg:grid-cols-[380px_280px] lg:gap-10">
        {/* ── Left column — form ── */}
        <div className="flex flex-col gap-5">
          {/* Heading */}
          <div>
            <h1 className="text-[18px] font-medium text-gray-900 dark:text-white leading-snug">
              Name your brand profile
            </h1>
            <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Give this profile a name so you can find it later. Agencies can
              create one profile per client — each with its own voice, tone, and
              language settings.
            </p>
          </div>

          {/* Profile name input */}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My brand"
            hint="Examples: 'Acme Corp blog', 'Agency client — Smith & Co', 'Executive comms'"
          />

          {/* Summary card — mobile only, sits between input and save button */}
          <div className="lg:hidden">
            <SummaryCard
              name={name}
              exampleCount={exampleCount}
              lang={languageVariant}
              tone={tone}
            />
          </div>

          {/* Save button + error + note */}
          <div className="flex flex-col gap-2.5">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving…" : "Save profile and start"}
            </Button>

            {saveError && (
              <p className="text-[13px] text-red-600 dark:text-red-400 text-center">
                {saveError}
              </p>
            )}

            <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
              You can edit this profile any time in Settings. There is no limit
              on profiles during your trial.
            </p>
          </div>
        </div>

        {/* ── Right column — desktop only ── */}
        <div className="hidden lg:flex flex-col gap-4">
          <SummaryCard
            name={name}
            exampleCount={exampleCount}
            lang={languageVariant}
            tone={tone}
          />
          <WhatHappensNextCard />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8">
        <Button variant="secondary" onClick={handleBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
