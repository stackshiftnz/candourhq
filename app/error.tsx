"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-brand-pink rounded-3xl flex items-center justify-center mb-8 shadow-sm">
        <span className="text-4xl text-white">!</span>
      </div>
      <h1 className="text-[40px] font-bold text-brand-dark tracking-tight leading-none mb-4">
        Something went wrong
      </h1>
      <p className="text-[17px] text-brand-dark/60 max-w-sm mb-8 font-medium">
        An unexpected error occurred. We&apos;ve been notified and are looking into it.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="lg"
          className="h-14 px-8 text-[16px]"
          onClick={() => reset()}
        >
          Try again
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="h-14 px-8 text-[16px]"
          onClick={() => (window.location.href = "/dashboard")}
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
