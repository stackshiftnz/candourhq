"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

// ─── Eye icon helpers ─────────────────────────────────────────────────────────

function EyeIcon() {
  return (
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
  );
}

function EyeOffIcon() {
  return (
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
  );
}

// ─── Password field with show/hide toggle ─────────────────────────────────────

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  autoComplete = "new-password",
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[12px] font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "h-[42px] w-full rounded-lg border px-3 pr-10 text-sm text-gray-900",
            "placeholder:text-gray-400 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1",
            "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500",
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 dark:border-gray-600",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ borderWidth: "0.5px" }}
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = "checking" | "ready" | "success";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [pageState, setPageState] = useState<PageState>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Session check ───────────────────────────────────────────────────────────
  // Covers two cases:
  //   1. PKCE flow: URL contains ?code= — exchange it for a session here.
  //   2. Implicit flow: recovery token is in the URL hash — browser client
  //      fires onAuthStateChange with event = 'PASSWORD_RECOVERY'.

  useEffect(() => {
    let redirected = false;

    // PKCE flow: exchange the one-time code for a session
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          setPageState("ready");
          // Remove the code from the URL so it can't be replayed
          window.history.replaceState({}, "", "/update-password");
        } else {
          router.replace("/reset-password?expired=1");
        }
      });
      return;
    }

    // Implicit flow: listen for PASSWORD_RECOVERY auth event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    // Also check for an existing session (e.g. navigated back after exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (pageState !== "ready") {
        if (session) {
          setPageState("ready");
        } else {
          setTimeout(() => {
            setPageState((current) => {
              if (current === "checking" && !redirected) {
                redirected = true;
                router.replace("/reset-password?expired=1");
              }
              return current;
            });
          }, 800);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    let valid = true;

    if (!newPassword) {
      setNewPasswordError("New password is required.");
      valid = false;
    } else if (newPassword.length < 8) {
      setNewPasswordError("Password must be at least 8 characters.");
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password.");
      valid = false;
    } else if (newPassword && confirmPassword !== newPassword) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    }

    if (!valid) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setFormError("Something went wrong. Please try again.");
      } else {
        setPageState("success");
        setTimeout(() => router.push("/dashboard"), 1500);
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (pageState === "checking") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6">
        <span className="inline-block w-5 h-5 rounded-full border-2 border-gray-900 border-r-transparent animate-spin dark:border-white" />
        <p className="text-[13px] text-gray-500 dark:text-gray-400">
          Verifying reset link…
        </p>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <p className="text-[15px] font-medium text-gray-900 dark:text-white">
          Password updated.
        </p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400">
          Redirecting you to your dashboard…
        </p>
        <span className="inline-block w-4 h-4 rounded-full border-2 border-gray-400 border-r-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Heading */}
      <div className="text-center">
        <h1 className="text-[20px] font-semibold text-gray-900 dark:text-white">
          Set a new password
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <PasswordField
          id="new-password"
          label="New password"
          placeholder="8+ characters"
          value={newPassword}
          onChange={(v) => {
            setNewPassword(v);
            if (newPasswordError) setNewPasswordError("");
          }}
          error={newPasswordError}
          autoComplete="new-password"
        />

        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v);
            if (confirmPasswordError) setConfirmPasswordError("");
          }}
          error={confirmPasswordError}
          autoComplete="new-password"
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
          Update password
        </Button>
      </form>
    </div>
  );
}
