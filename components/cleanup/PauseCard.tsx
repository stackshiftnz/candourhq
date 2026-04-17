"use client";

import { useState } from "react";
import { CleanupParagraph as CleanupParagraphType } from "@/lib/anthropic/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
    <div className="border border-amber-300 bg-amber-50 rounded-xl overflow-hidden shadow-sm animate-in zoom-in-95 duration-300">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-[12px] font-bold text-amber-600 uppercase tracking-widest">
          Missing Fact — Your Input Needed
        </span>
        <button 
          onClick={handleSkip}
          className="h-11 px-4 text-[12px] font-medium text-amber-800 hover:text-amber-950 transition-colors bg-transparent border-none flex items-center"
        >
          Skip this one
        </button>
      </div>

      <div className="px-4 py-2 space-y-1">
        <h3 className="text-[13px] font-medium text-gray-900 leading-snug">
          {paragraph.pause_card.question}
        </h3>
        <p className="text-[12px] text-amber-900/60 italic">
          {paragraph.pause_card.hint}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-4 pt-2">
        <div className="flex gap-2">
          <Input 
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type the missing fact here..."
            className="h-11 text-[13px] bg-white border-amber-200 focus:border-amber-400 focus:ring-amber-400/20"
            autoFocus
          />
          <Button 
            type="submit"
            variant="primary" 
            size="sm"
            disabled={!answer.trim() || isSubmitting}
            loading={isSubmitting}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-none"
          >
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}
