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
  const { Eye, EyeOff } = require("lucide-react");

  return (
    <div className="flex flex-col gap-6">
      {/* Session Expired Banner */}
      {sessionExpired && (
        <div className="bg-accent/10 border border-accent/20 text-accent px-4 py-3 rounded-xl text-xs font-semibold text-center animate-in fade-in slide-in-from-top-2 duration-500">
          Your session expired. Please sign in again.
        </div>
      )}

      {/* Heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmitAction} noValidate className="flex flex-col gap-5">
        <Input
          label="Work email"
          type="email"
          placeholder="alex@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={formError && email === "" ? "Required" : ""}
        />

        {/* Password field logic */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Password
            </label>
            <Link
              href="/reset-password"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative group">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 pr-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-sans"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Form-level error */}
        {formError && (
          <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-center gap-2 animate-in zoom-in-95 duration-200">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <p className="text-xs font-medium text-accent">
              {formError}
            </p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full shadow-lg shadow-primary/5 mt-2"
        >
          Sign in
        </Button>
      </form>

      {/* Sign-up link */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">OR</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-bold text-foreground hover:underline underline-offset-4 decoration-primary decoration-2 transition-all"
          >
            Create account
          </Link>
        </p>
      </div>
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
