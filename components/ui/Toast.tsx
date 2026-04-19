"use client";

import React, { createContext, useState, useCallback, ReactNode } from "react";
import { X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Auto-dismiss duration based on type if not specified
    const defaultDuration = (type === "error" || type === "warning") ? 6000 : 4000;
    const finalDuration = duration ?? defaultDuration;

    setToasts((prev) => {
      const next = [...prev, { id, message, type, duration: finalDuration }];
      // Keep only the most recent 3
      if (next.length > 3) {
        return next.slice(-3);
      }
      return next;
    });

    setTimeout(() => {
      removeToast(id);
    }, finalDuration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 md:top-6 md:right-8 z-[9999] flex flex-col gap-3 w-full max-w-[calc(100vw-2rem)] md:max-w-sm pointer-events-none items-center md:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`
              pointer-events-auto flex items-start gap-3 w-full p-4 rounded-xl shadow-2xl text-[13px] font-medium
              animate-in slide-in-from-right-8 fade-in duration-300 transition-all border
              ${t.type === "success" ? "bg-white border-green-100 text-gray-900" : ""}
              ${t.type === "error" ? "bg-red-50 border-red-100 text-red-900" : ""}
              ${t.type === "warning" ? "bg-amber-50 border-amber-100 text-amber-900" : ""}
              ${t.type === "info" ? "bg-blue-50 border-blue-100 text-blue-900" : ""}
            `}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {t.type === "success" && <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">✓</div>}
              {t.type === "error" && <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px]">✗</div>}
              {t.type === "warning" && <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px]">!</div>}
              {t.type === "info" && <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">i</div>}
            </div>

            <div className="flex-1 leading-tight py-0.5">
              {t.message}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-900 transition-colors p-1 -m-1"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
