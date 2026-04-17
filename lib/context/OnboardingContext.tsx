"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type Tone =
  | "formal"
  | "conversational"
  | "technical"
  | "warm"
  | "direct";

interface OnboardingState {
  examples: string[];
  languageVariant: "en-US" | "en-GB";
  tone: Tone;
  profileName: string;
  setExamples: (examples: string[]) => void;
  setLanguageVariant: (variant: "en-US" | "en-GB") => void;
  setTone: (tone: Tone) => void;
  setProfileName: (name: string) => void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [examples, setExamples] = useState<string[]>([]);
  const [languageVariant, setLanguageVariant] = useState<"en-US" | "en-GB">("en-US");
  const [tone, setTone] = useState<Tone>("conversational");
  const [profileName, setProfileName] = useState<string>("My brand");

  return (
    <OnboardingContext.Provider
      value={{
        examples,
        languageVariant,
        tone,
        profileName,
        setExamples,
        setLanguageVariant,
        setTone,
        setProfileName,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  }
  return ctx;
}
