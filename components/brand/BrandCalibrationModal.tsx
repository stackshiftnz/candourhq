"use client";

import { useState } from "react";
import { X, Sparkles, Plus, Trash2, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { CalibrateResponse } from "@/lib/anthropic/types";

interface BrandCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCalibrate: (data: CalibrateResponse) => void;
}

export function BrandCalibrationModal({ isOpen, onClose, onCalibrate }: BrandCalibrationModalProps) {
  const [samples, setSamples] = useState<string[]>([""]);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const addSample = () => {
    if (samples.length < 3) {
      setSamples([...samples, ""]);
    }
  };

  const updateSample = (index: number, value: string) => {
    const next = [...samples];
    next[index] = value;
    setSamples(next);
  };

  const removeSample = (index: number) => {
    if (samples.length > 1) {
      setSamples(samples.filter((_, i) => i !== index));
    } else {
      updateSample(0, "");
    }
  };

  const handleStartAnalysis = async () => {
    const validSamples = samples.filter(s => s.trim().length > 10);
    if (validSamples.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/brand/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: validSamples }),
      });

      if (!res.ok) throw new Error("Failed to calibrate");

      const data = await res.json();
      onCalibrate(data);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalWords = samples.reduce((acc, s) => acc + (s.trim().split(/\s+/).filter(Boolean).length), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/60 backdrop-blur-xl animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-3xl bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-[600px]">
          {/* Left: Branding/Visual */}
          <div className="w-full md:w-[280px] bg-muted/30 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border shrink-0">
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <Sparkles size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight leading-tight">Brand Voice Calibration</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Linguistic Inference Engine</p>
              </div>
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed font-medium">
                Supply existing writing samples. Our engine will reverse-engineer your stylistic vectors to create a structured brand matrix draft.
              </p>
            </div>
            
            <div className="space-y-4">
               <div className="p-4 rounded-2xl bg-background/50 border border-border/50 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                     <span>Data Density</span>
                     <span>{totalWords} Words</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${Math.min(100, (totalWords / 500) * 100)}%` }} 
                     />
                  </div>
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                  <Zap size={10} className="text-primary" fill="currentColor" /> System calibrated for professional precision.
               </div>
            </div>
          </div>

          {/* Right: Samples Input */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-10 space-y-8">
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">Supply writing samples.</h2>
                <p className="text-sm text-muted-foreground">The more text you provide, the more accurate the calibration.</p>
              </div>

              <div className="space-y-6">
                {samples.map((sample, idx) => (
                  <div key={idx} className="space-y-3 group/sample">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Sample Vector #{idx + 1}</span>
                      {samples.length > 1 && (
                        <button 
                          onClick={() => removeSample(idx)}
                          className="p-1.5 opacity-0 group-hover/sample:opacity-100 hover:bg-accent/10 hover:text-accent rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <Textarea
                      value={sample}
                      onChange={(e) => updateSample(idx, e.target.value)}
                      placeholder="Paste a writing sample you're proud of..."
                      className="min-h-[120px] rounded-3xl bg-muted/10 border-border/50 focus:bg-background transition-all p-6 text-sm font-medium resize-none"
                    />
                  </div>
                ))}

                {samples.length < 3 && (
                  <button
                    onClick={addSample}
                    className="w-full py-4 rounded-3xl border-2 border-dashed border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} strokeWidth={3} />
                    Add another sample vector
                  </button>
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-8 lg:p-10 pt-0 shrink-0">
              <Button
                className="w-full h-16 rounded-[28px] font-bold text-sm bg-foreground text-background hover:scale-[1.01] active:scale-[0.99] transition-all shadow-2xl shadow-black/20"
                onClick={handleStartAnalysis}
                loading={isLoading}
                disabled={samples.every(s => s.trim().length < 10)}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {isLoading ? "Analyzing Linguistic Vectors..." : "Calibrate Brand Matrix"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
