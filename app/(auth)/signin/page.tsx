"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useToast } from "@/lib/hooks/useToast";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const sessionExpired = searchParams.get("reason") === "session-expired";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formError, setFormError] = useState("");
  const { toast } = useToast();

  const { execute: handleSubmitAction, loading } = useAsyncAction(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");

      if (!email.trim() || !password) {
        setFormError("Please enter your email and password.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message ?? "";
        if (msg.toLowerCase().includes("email not confirmed")) {
          setFormError(
            "Please verify your email before signing in."
          );
        } else {
          setFormError("Invalid email or password.");
        }
        return;
      }

      // Check onboarding status and redirect accordingly.
      const userId = data.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", userId)
        .single();

      if (profile?.onboarding_completed) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    },
    {
      onTimeout: () => {
        toast("This is taking longer than expected. Please try again.", "error");
      },
      onError: () => {
        setFormError("Something went wrong. Please try again.");
      }
    }
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Session Expired Banner */}
      {sessionExpired && (
        <div className="bg-amber-50 border border-amber-100 text-amber-900 px-4 py-3 rounded-xl text-[13px] font-medium text-center animate-in fade-in slide-in-from-top-4 duration-500">
          Your session expired. Please sign in again.
        </div>
      )}

      {/* Heading */}
      <div className="text-center">
        <h1 className="text-[20px] font-semibold text-gray-900 dark:text-white">
          Welcome back
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmitAction} noValidate className="flex flex-col gap-4">
        <Input
          label="Work email"
          type="email"
          placeholder="alex@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password with show/hide toggle */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="text-[12px] font-medium text-gray-700 dark:text-gray-300"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={[
                "h-[44px] w-full rounded-lg border px-3 pr-10 text-[12px] text-gray-900",
                "placeholder:text-gray-400 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1",
                "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500",
                "border-gray-300 dark:border-gray-600",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ borderWidth: "0.5px" }}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link
              href="/reset-password"
              className="inline-flex items-center min-h-[44px] text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Form-level error */}
        {formError && (
          <p className="text-[13px] text-red-600 dark:text-red-400 text-center">
            {formError}
          </p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Sign in
        </Button>
      </form>

      {/* Sign-up link */}
      <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="inline-flex items-center min-h-[44px] font-medium text-gray-900 dark:text-white hover:underline underline-offset-2"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
