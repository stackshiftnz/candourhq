"use client";

import { X, ShieldCheck, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { RefinementAmbition } from "@/lib/anthropic/types";

interface CleanupAmbitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (ambition: RefinementAmbition) => void;
  isLoading?: boolean;
}

export function CleanupAmbitionModal({ isOpen, onClose, onConfirm, isLoading }: CleanupAmbitionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/60 backdrop-blur-xl animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full">
          {/* Left: Branding/Visual */}
          <div className="w-full md:w-[240px] bg-muted/30 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight">Refinement Ambition</h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Editor 2.0 Engine</p>
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="p-4 rounded-2xl bg-background/50 border border-border/50 text-[10px] leading-relaxed text-muted-foreground italic">
                "Precision is not just fixing errors; it's revealing the value hidden within the prose."
              </div>
            </div>
          </div>

          {/* Right: Choices */}
          <div className="flex-1 p-8 lg:p-10 space-y-8">
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">Select your editing intensity.</h2>
              <p className="text-sm text-muted-foreground">The AI Editor will adjust its intervention level based on your strategic goal.</p>
            </div>

            <div className="grid gap-4">
              {/* Conservative Option */}
              <button
                onClick={() => onConfirm("conservative")}
                className="group relative flex items-start gap-5 p-5 rounded-3xl border border-border bg-background hover:border-primary/50 hover:bg-muted/10 transition-all text-left"
              >
                <div className="mt-1 w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-foreground">Conservative Refinement</h4>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Surgical Fix</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Strictly resolves flagged issues while preserving your original sentence structure and flow. Best for high-stakes regulatory or technical docs.
                  </p>
                </div>
              </button>

              {/* Transformative Option */}
              <button
                onClick={() => onConfirm("transformative")}
                className="group relative flex items-start gap-5 p-5 rounded-3xl border border-border bg-background hover:border-secondary/50 hover:bg-secondary/[0.03] transition-all text-left"
              >
                <div className="mt-1 w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-secondary/10 group-hover:text-secondary transition-colors shrink-0">
                  <Zap size={20} fill="currentColor" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-foreground">Transformative Refinement</h4>
                    <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-[9px] font-bold uppercase tracking-wider text-secondary">Strategic Re-engineering</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Elevates your document to elite professional standards. Fixes issues AND re-works structure for maximum clarity, impact, and concise flow.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 justify-center">
              <Zap size={10} className="text-primary" fill="currentColor" /> All modes allow manual review and roll-backs.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
