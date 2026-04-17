"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

// ─── Inner form — reads searchParams (must be inside Suspense) ────────────────

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setEmailError("");

    if (!email.trim()) {
      setEmailError("Work email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            process.env.NEXT_PUBLIC_APP_URL + "/update-password",
        }
      );

      if (error) {
        const status = (error as { status?: number }).status;
        if (
          status === 429 ||
          error.message?.toLowerCase().includes("rate limit") ||
          error.message?.toLowerCase().includes("too many")
        ) {
          setFormError("Too many attempts. Please wait a few minutes and try again.");
        } else {
          setFormError("Something went wrong. Please try again.");
        }
      } else {
        setSent(true);
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-[20px] font-semibold text-gray-900 dark:text-white">
            Reset your password
          </h1>
        </div>
        <p className="text-[14px] text-gray-700 dark:text-gray-300 text-center leading-relaxed">
          If this email is registered, you&apos;ll receive a reset link.
        </p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center">
          <Link
            href="/signin"
            className="font-medium text-gray-900 dark:text-white hover:underline underline-offset-2"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Heading */}
      <div className="text-center">
        <h1 className="text-[20px] font-semibold text-gray-900 dark:text-white">
          Reset your password
        </h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
          Enter your work email and we&apos;ll send you a reset link.
        </p>
      </div>

      {/* Expired / invalid link notice */}
      {expired && (
        <p className="text-[13px] text-red-600 dark:text-red-400 text-center">
          This reset link has expired or is invalid. Request a new one.
        </p>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Work email"
          type="email"
          placeholder="alex@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          error={emailError}
        />

        {formError && (
          <p className="text-[13px] text-red-600 dark:text-red-400 text-center">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Send reset link
        </Button>
      </form>

      {/* Back link */}
      <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center">
        <Link
          href="/signin"
          className="font-medium text-gray-900 dark:text-white hover:underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

// ─── Page — wraps form in Suspense for useSearchParams ───────────────────────

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
