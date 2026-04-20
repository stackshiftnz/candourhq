"use client";

import { useState } from "react";
import { CleanupParagraph as CleanupParagraphType } from "@/lib/anthropic/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { 
  Zap, 
  Send, 
  X, 
  HelpCircle, 
  Lightbulb,
  ArrowRight
} from "lucide-react";

interface PauseCardProps {
  paragraph: CleanupParagraphType;
  onResolve: (answer: string | null, skipped: boolean) => void;
}

export function PauseCard({ paragraph, onResolve }: PauseCardProps) {
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    
    setIsSubmitting(true);
    // Simulate slight delay for feedback loop
    setTimeout(() => {
      onResolve(answer.trim(), false);
      setIsSubmitting(false);
    }, 300);
  };

  const handleSkip = () => {
    onResolve(null, true);
  };

  if (!paragraph.pause_card) return null;

  return (
    <div className="group relative border border-secondary/30 bg-card rounded-[32px] overflow-hidden shadow-2xl shadow-secondary/5 animate-in zoom-in-95 duration-500">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="px-8 pt-8 pb-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
              <Zap size={18} fill="currentColor" />
           </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Signal Intervention</span>
               <h4 className="text-sm font-bold text-foreground">Structural Integrity Gap</h4>
            </div>
        </div>
        <button 
          onClick={handleSkip}
          className="p-2 hover:bg-muted rounded-full transition-all text-muted-foreground hover:text-foreground"
          title="Skip this prompt"
        >
          <X size={20} />
        </button>
      </div>

      <div className="px-8 py-4 space-y-4 relative z-10">
        <div className="space-y-2">
           <h3 className="text-lg lg:text-xl font-bold text-foreground leading-tight tracking-tight">
             {paragraph.pause_card.question}
           </h3>
           <div className="flex items-start gap-2 text-muted-foreground/60 italic text-[13px] font-medium leading-relaxed bg-muted/30 p-4 rounded-2xl border border-border/50">
             <Lightbulb size={14} className="mt-1 shrink-0 text-secondary" />
             {paragraph.pause_card.hint}
           </div>
        </div>

        <form onSubmit={handleSubmit} className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative group/input">
              <Input 
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Declare the missing fact..."
                className="h-14 px-6 rounded-2xl bg-muted/50 border-border/50 focus:border-secondary/50 focus:ring-secondary/10 text-base font-medium shadow-inner"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                 <HelpCircle size={18} />
              </div>
            </div>
            <Button 
              type="submit"
              variant="brand" 
              size="lg"
              disabled={!answer.trim() || isSubmitting}
              loading={isSubmitting}
               className="h-14 px-8 rounded-2xl font-bold text-sm bg-foreground text-background shadow-xl shadow-primary/20"
            >
              Integrate <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        </form>
      </div>
      
      {/* Footer subtle text */}
      <div className="px-8 py-3 bg-muted/20 border-t border-border/50 flex justify-center">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Woven Precision Protocol Alpha</span>
      </div>
    </div>
  );
}
