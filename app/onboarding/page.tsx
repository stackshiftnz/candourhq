"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { skipOnboarding } from "@/app/actions/onboarding";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 1v12M1 7h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Example card ─────────────────────────────────────────────────────────────

function ExampleCard({
  label,
  badge,
  rows,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  badge: ReactNode;
  rows: number;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        {badge}
      </div>
      {/* Textarea */}
      <div className="p-3">
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 bg-transparent leading-relaxed focus:outline-none"
        />
      </div>
    </div>
  );
}

// ─── Hints panel ─────────────────────────────────────────────────────────────

const HINTS = [
  {
    label: "Use real published content",
    body: "Something finished and sent — not a draft.",
    quote: false,
  },
  {
    label: "Mix content types if you can",
    body: "A blog post and an email teach more than two blog posts.",
    quote: false,
  },
  {
    label: "Length matters less than quality",
    body: "200 focused words beats 1,000 padded words.",
    quote: false,
  },
  {
    label: "What Candour looks for",
    body: "Sentence rhythm, vocabulary preferences, formality level, how you open and close arguments, and phrases you naturally reach for.",
    quote: true,
  },
] as const;

function HintsPanel() {
  return (
    <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-[12px] font-medium text-gray-900 dark:text-gray-100 mb-4">
        What makes a good example?
      </p>
      <ul className="flex flex-col gap-4">
        {HINTS.map(({ label, body, quote }) => (
          <li key={label}>
            <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              {label}
            </p>
            {quote ? (
              <p className="text-[12px] text-gray-500 dark:text-gray-400 italic leading-relaxed border-l-2 border-gray-200 dark:border-gray-700 pl-2.5">
                &ldquo;{body}&rdquo;
              </p>
            ) : (
              <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {body}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingStep1Page() {
  const router = useRouter();
  const { examples, setExamples } = useOnboarding();

  // Initialise from context so back-navigation restores entered text.
  const [ex1, setEx1] = useState<string>(() => examples[0] ?? "");
  const [ex2, setEx2] = useState<string>(() => examples[1] ?? "");
  const [ex3, setEx3] = useState<string>(() => examples[2] ?? "");

  // Show third card if context already has ≥ 3 entries (back nav from step 2).
  const [showThird, setShowThird] = useState<boolean>(
    () => examples.length >= 3
  );
  const [isSkipping, setIsSkipping] = useState(false);

  const canProceed = ex1.trim().length > 0;

  function handleNext() {
    // Save only non-empty examples to context.
    const filled = [ex1, ex2, ex3].filter((s) => s.trim().length > 0);
    setExamples(filled);
    router.push("/onboarding/preferences");
  }

  async function handleSkip() {
    setIsSkipping(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await skipOnboarding(user.id);
      }
      router.push("/sample");
    } catch {
      setIsSkipping(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 max-w-[960px]">
      {/* Two-column grid on desktop, single column on mobile */}
      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-5">
          {/* Heading + subheading */}
          <div>
            <h1 className="text-[18px] font-medium text-gray-900 dark:text-white leading-snug">
              Show us what good looks like for your brand
            </h1>
            <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Paste 1 to 3 pieces of writing you&apos;re proud of. A blog post,
              email, proposal — anything that sounds like you at your best. One
              example is enough to get started.
            </p>
          </div>

          {/* Example 1 */}
          <ExampleCard
            label="Example 1"
            badge={
              <Badge variant="neutral" size="sm">
                Required
              </Badge>
            }
            rows={5}
            value={ex1}
            onChange={setEx1}
            placeholder="Paste your best writing here — a recent email, blog post, client proposal, or any content that sounds like your brand at its best…"
          />

          {/* Example 2 */}
          <ExampleCard
            label="Example 2"
            badge={
              <Badge variant="neutral" size="sm">
                Optional
              </Badge>
            }
            rows={4}
            value={ex2}
            onChange={setEx2}
            placeholder="A second example from a different content type helps Candour learn more about your voice across formats…"
          />

          {/* Example 3 or add-third button */}
          {showThird ? (
            <ExampleCard
              label="Example 3"
              badge={
                <Badge variant="neutral" size="sm">
                  Optional
                </Badge>
              }
              rows={4}
              value={ex3}
              onChange={setEx3}
              placeholder="A third example adds even more signal — especially if it covers a different format or audience…"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowThird(true)}
              className="flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-[13px] text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 dark:hover:border-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <PlusIcon />
              Add a third example
            </button>
          )}

          {/* Privacy note */}
          <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-[1.55]">
            These examples are private to your account and are never shared,
            published, or used to train AI models. They are used only to learn
            your writing style.
          </p>
        </div>

        {/* ── Right column — hints panel, desktop only ── */}
        <div className="hidden lg:block">
          <HintsPanel />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 flex items-center justify-between gap-4">
        {/* Mobile skip text is shorter to save space */}
        <span className="sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            loading={isSkipping}
            disabled={isSkipping}
          >
            Skip setup
          </Button>
        </span>
        <span className="hidden sm:block">
          <Button
            variant="ghost"
            onClick={handleSkip}
            loading={isSkipping}
            disabled={isSkipping}
          >
            Skip — show me a sample instead
          </Button>
        </span>

        <Button
          variant="primary"
          onClick={handleNext}
          disabled={!canProceed}
        >
          Next — language and tone
        </Button>
      </div>
    </div>
  );
}
