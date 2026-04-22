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
  ArrowRight,
  History,
  ChevronDown
} from "lucide-react";

interface PauseCardProps {
  paragraph: CleanupParagraphType;
  onResolve: (answer: string | null, skipped: boolean) => void;
  savedFacts?: { label: string; value: string }[];
}

export function PauseCard({ paragraph, onResolve, savedFacts = [] }: PauseCardProps) {
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFactRegistryOpen, setIsFactRegistryOpen] = useState(false);

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
                className="h-14 px-6 rounded-2xl bg-muted/50 border-border/50 focus:border-secondary/50 focus:ring-secondary/10 text-base font-medium shadow-inner pr-12"
                autoFocus
              />
              
              {savedFacts.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                   <button
                     type="button"
                     onClick={() => setIsFactRegistryOpen(!isFactRegistryOpen)}
                     className={cn(
                       "p-2 rounded-xl transition-all flex items-center gap-1.5",
                       isFactRegistryOpen 
                        ? "bg-secondary text-white shadow-lg shadow-secondary/20" 
                        : "bg-muted/50 text-muted-foreground/40 hover:text-secondary hover:bg-secondary/10"
                     )}
                     title="Access Fact Registry"
                   >
                     <History size={16} />
                     <ChevronDown size={12} className={cn("transition-transform duration-300", isFactRegistryOpen && "rotate-180")} />
                   </button>
                </div>
              )}

              {/* Fact Registry Dropdown */}
              {isFactRegistryOpen && savedFacts.length > 0 && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsFactRegistryOpen(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 max-h-64 overflow-y-auto z-50 p-2 bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-2 border-b border-border/30 mb-1">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Fact Registry</span>
                    </div>
                    {savedFacts.map((fact, idx) => (
                      <button
                        key={`${fact.label}-${idx}`}
                        type="button"
                        onClick={() => {
                          setAnswer(fact.value);
                          setIsFactRegistryOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-secondary/10 group/item transition-colors flex flex-col gap-0.5"
                      >
                        <span className="text-[9px] font-bold uppercase tracking-wide text-secondary/60 group-hover/item:text-secondary">
                          {fact.label}
                        </span>
                        <span className="text-[13px] font-medium text-foreground truncate">
                          {fact.value}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
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
