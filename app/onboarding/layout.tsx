import { OnboardingProvider } from "@/lib/context/OnboardingContext";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <OnboardingShell>{children}</OnboardingShell>
    </OnboardingProvider>
  );
}
