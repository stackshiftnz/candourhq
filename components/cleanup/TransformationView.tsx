"use client";

import { useMemo } from "react";
import { Zap, Sparkles, Layers, ShieldCheck, Settings, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransformationViewProps {
  brandProfileName?: string | null;
  progress: number;
  isTakingLong?: boolean;
  isStalled?: boolean;
}

const STAGES = [
  { threshold: 0,  icon: Settings,   label: "Writing clean paragraphs..." },
  { threshold: 25, icon: RefreshCw,   label: "Applying brand voice..." },
  { threshold: 50, icon: Layers,      label: "Resolving evidence gaps..." },
  { threshold: 75, icon: Sparkles,    label: "Finalising..." },
  { threshold: 99, icon: ShieldCheck, label: "Wrapping up..." },
];

export function TransformationView({ brandProfileName, progress, isTakingLong, isStalled }: TransformationViewProps) {
  const currentStage = useMemo(() => {
    return [...STAGES].reverse().find((s) => progress >= s.threshold) || STAGES[0];
  }, [progress]);

  const profileLabel = brandProfileName ?? "Default Profile";
  const displayLabel = currentStage.threshold === 25
    ? `Applying ${profileLabel} Voice...`
    : currentStage.label;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 max-w-2xl mx-auto w-full animate-in fade-in duration-700">
      {/* Central animation */}
      <div className="relative w-32 h-32 md:w-40 md:h-40">
        <div className="absolute inset-0 rounded-3xl bg-secondary/5 animate-pulse" />
        <div className="absolute inset-[-10px] rounded-[40px] border border-secondary/10 animate-[ping_3s_linear_infinite]" />
        <div className="absolute inset-0 rounded-3xl border-2 border-secondary/20 border-r-secondary border-b-secondary animate-spin [animation-duration:4s]" />
        <div className="absolute inset-4 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex items-center justify-center overflow-hidden border border-border">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary/10 to-transparent animate-[shimmer_2s_linear_infinite]" />
          <currentStage.icon className="w-10 h-10 md:w-12 md:h-12 text-secondary animate-bounce" />
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 w-2 h-2 bg-primary rounded-full animate-pulse" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 w-2 h-2 bg-primary rounded-full [animation-delay:1s] animate-pulse" />
      </div>

      {/* Progress */}
      <div className="w-full space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground italic">
            Refining Intelligence
          </h2>
          <div className="flex items-center justify-center gap-2 h-6">
            <span
              className="text-sm font-medium text-muted-foreground animate-in slide-in-from-bottom-2 duration-500"
              key={displayLabel}
            >
              {displayLabel}
            </span>
          </div>
        </div>

        <div className="relative w-full max-w-md mx-auto">
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
            {progress > 0 ? (
              <div
                className="h-full bg-secondary transition-all duration-700 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2.5s_infinite]" />
              </div>
            ) : (
              <div className="h-full w-2/5 bg-secondary rounded-full animate-[indeterminate_1.6s_ease-in-out_infinite]" />
            )}
          </div>
          <div className="absolute -top-6 right-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary/80">
              {progress > 0 ? `${Math.round(progress)}%` : "Processing…"}
            </span>
          </div>
        </div>

        <p className={cn(
          "text-[13px] text-muted-foreground/60 max-w-sm mx-auto leading-relaxed h-10 flex items-center justify-center",
          isStalled && "text-amber-600/80"
        )}>
          {isStalled
            ? "Still generating — large documents can take a moment."
            : isTakingLong
              ? "This transformer is deep-processing — almost there."
              : progress > 80
                ? "Final alignment checks for publishing readiness..."
                : "Converting quality signals into publishable content blocks."}
        </p>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
