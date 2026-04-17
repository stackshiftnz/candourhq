"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { useToast } from "@/lib/hooks/useToast";

// ─── Field error state ────────────────────────────────────────────────────────

interface FieldErrors {
  fullName: string;
  email: string;
  password: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    fullName: "",
    email: "",
    password: "",
  });
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const { execute: handleSubmitAction, loading } = useAsyncAction(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");

      if (!validate()) return;

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL + "/auth/callback",
        },
      });

      if (error) {
        const msg = error.message ?? "";
        const status = (error as { status?: number }).status;
        if (
          msg.toLowerCase().includes("user already registered") ||
          msg.toLowerCase().includes("already registered")
        ) {
          setFormError(
            "An account with this email already exists. Sign in instead."
          );
        } else if (msg.toLowerCase().includes("password should be at least 6")) {
          setFieldErrors((prev) => ({
            ...prev,
            password: "Password must be at least 6 characters.",
          }));
        } else if (
          status === 429 ||
          msg.toLowerCase().includes("rate limit") ||
          msg.toLowerCase().includes("too many")
        ) {
          setFormError(
            "Too many sign-up attempts. Please wait a few minutes and try again."
          );
        } else if (msg.toLowerCase().includes("fetch")) {
          setFormError("Connection error. Please try again.");
        } else {
          setFormError("Something went wrong. Please try again.");
        }
      } else {
        setSuccess(true);
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

  function validate() {
    let valid = true;
    const errors: FieldErrors = { fullName: "", email: "", password: "" };

    if (!fullName.trim()) {
      errors.fullName = "Full name is required";
      valid = false;
    }
    if (!email.trim()) {
      errors.email = "Email is required";
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Invalid email address";
      valid = false;
    }
    if (!password) {
      errors.password = "Password is required";
      valid = false;
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
      valid = false;
    }

    setFieldErrors(errors);
    return valid;
  }

  // ── Success state ───────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="text-center py-4">
        <p className="text-[15px] text-gray-900 dark:text-white font-medium leading-relaxed">
          Check your email to verify your account before signing in.
        </p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <Link
            href="/signin"
            className="inline-flex items-center min-h-[44px] text-gray-900 dark:text-white underline underline-offset-2"
          >
            sign in
          </Link>{" "}
          to resend.
        </p>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Badge + heading */}
      <div className="flex flex-col items-center gap-3 text-center">
        <Badge variant="success">Free 14-day trial — no card needed</Badge>
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 dark:text-white">
            Create your account
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
            Write AI content your brand would actually publish.
          </p>
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmitAction} noValidate className="flex flex-col gap-4">
        <Input
          label="Full name"
          type="text"
          placeholder="Alex Johnson"
          autoComplete="name"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            if (fieldErrors.fullName)
              setFieldErrors((prev) => ({ ...prev, fullName: "" }));
          }}
          error={fieldErrors.fullName}
        />

        <Input
          label="Work email"
          type="email"
          placeholder="alex@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email)
              setFieldErrors((prev) => ({ ...prev, email: "" }));
          }}
          error={fieldErrors.email}
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
              placeholder="8+ characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password)
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
              }}
              className={[
                "h-[44px] w-full rounded-lg border px-3 pr-10 text-sm text-gray-900",
                "placeholder:text-gray-400 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1",
                "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500",
                fieldErrors.password
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600",
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
          {fieldErrors.password && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.password}
            </p>
          )}
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
          Create account
        </Button>
      </form>

      {/* Terms */}
      <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
        By creating an account you agree to our{" "}
        <a
          href="#"
          className="inline-flex items-center min-h-[44px] underline underline-offset-2 hover:text-gray-700"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="#"
          className="inline-flex items-center min-h-[44px] underline underline-offset-2 hover:text-gray-700"
        >
          Privacy Policy
        </a>
      </p>

      {/* Sign-in link */}
      <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="inline-flex items-center min-h-[44px] font-medium text-gray-900 dark:text-white hover:underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
