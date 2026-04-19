"use client";

import { ChangeTag } from "@/lib/anthropic/types";
import { X } from "lucide-react";

interface ExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tag: ChangeTag | null;
}

export function ExplanationDrawer({ isOpen, onClose, tag }: ExplanationDrawerProps) {
  if (!isOpen || !tag) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/15 z-[100] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 md:top-0 md:left-auto md:w-[280px] bg-white border-t md:border-t-0 md:border-l border-gray-100 shadow-2xl z-[101] animate-in slide-in-from-bottom md:slide-in-from-right duration-300 ease-out flex flex-col max-h-[80vh] md:max-h-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 h-[48px] border-b border-gray-50">
          <h2 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">
            {tag.tag.replace(/_/g, " ")}
          </h2>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-900 -mr-2"
          >
            <X size={18} className="pointer-events-none" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
          {/* Original */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Original</h3>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-[13px] text-gray-600 italic leading-relaxed">
              &quot;{tag.original_phrase}&quot;
            </div>
          </div>

          {/* Cleaned */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-teal-600">Cleaned</h3>
            <div className="bg-white border border-teal-100 rounded-lg p-3 text-[13px] text-gray-900 leading-relaxed shadow-sm">
              &quot;{tag.cleaned_phrase}&quot;
            </div>
          </div>

          {/* Why */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Why this change</h3>
            <p className="text-[13px] text-gray-700 leading-relaxed">
              {tag.explanation}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
