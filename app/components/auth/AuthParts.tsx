"use client";

import { useEffect, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getProviders, signIn } from "next-auth/react";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthHeader({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
  action,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        placeholder={placeholder}
        className="h-11 pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        tone === "error" && "border-destructive/40 bg-destructive/10 text-red-200",
        tone === "info" && "border-violet-400/30 bg-violet-500/10 text-violet-100",
        tone === "success" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
      )}
    >
      {children}
    </div>
  );
}

/** "Continue with Google" — rendered only when Google OAuth is configured on the server. */
export function GoogleButton({ callbackUrl, label = "Continue with Google" }: { callbackUrl: string; label?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getProviders()
      .then((providers) => active && setEnabled(Boolean(providers?.google)))
      .catch(() => active && setEnabled(false));
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          void signIn("google", { callbackUrl });
        }}
      >
        <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
          <path fill="#EA4335" d="M12 5.3c1.6 0 3 .5 4.1 1.5l3-3C17.4 1.6 14.9.6 12 .6 7.6.6 3.8 3.2 2 7l3.8 3C6.6 7.5 9 5.3 12 5.3z" />
          <path fill="#34A853" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.6c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.8c2.1-1.9 3.4-4.8 3.4-8.7z" />
          <path fill="#FBBC05" d="M5.8 14.4c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L2 7c-.6 1.2-1 2.6-1 4.1s.4 2.9 1 4.1l3.8-2.8z" />
          <path fill="#4285F4" d="M12 23.4c2.9 0 5.3-.9 7.1-2.6l-3.7-2.8c-1 .7-2.3 1.1-3.7 1.1-3 0-5.4-2-6.3-4.7l-3.8 2.8C4 20.9 7.6 23.4 12 23.4z" />
        </svg>
        {label}
      </Button>
      <div className="relative my-6 text-center text-xs uppercase tracking-wider text-muted-foreground">
        <span className="relative z-10 bg-background px-3">or</span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
      </div>
    </>
  );
}

export function useFieldId(name: string) {
  const id = useId();
  return `${name}-${id.replace(/:/g, "")}`;
}

/** Maps verification error codes (from the API or NextAuth) to friendly messages. */
export function otpErrorMessage(code: string | null | undefined): { message: string; restart?: boolean } {
  if (!code) return { message: "Something went wrong. Please try again." };
  const [base, remaining] = code.split(":");
  switch (base) {
    case "CODE_INVALID":
      return {
        message: remaining ? `That code isn't right. ${remaining} attempt${remaining === "1" ? "" : "s"} left.` : "Enter the 6-digit code from your email.",
      };
    case "CODE_EXPIRED":
      return { message: "This code has expired. Request a new one below." };
    case "CODE_USED":
    case "CODE_UNAVAILABLE":
      return { message: "This code is no longer valid. Request a new one below." };
    case "TOO_MANY_ATTEMPTS":
      return { message: "Too many incorrect attempts. Request a new code to try again." };
    case "CHALLENGE_NOT_FOUND":
      return { message: "This verification session has expired. Please start again.", restart: true };
    case "RATE_LIMITED":
      return { message: "Too many attempts. Please wait a few minutes and try again." };
    case "EMAIL_TAKEN":
      return { message: "An account with this email already exists. Try signing in instead.", restart: true };
    case "ACCOUNT_UNAVAILABLE":
      return { message: "This account is not available. Please contact support.", restart: true };
    default:
      return { message: "Something went wrong. Please try again." };
  }
}

/** Messages for errors NextAuth reports via ?error= after OAuth redirects. */
export function authRedirectError(code: string | null): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    OAuthAccountNotLinked: "This email is already linked to another sign-in method.",
    GOOGLE_EMAIL_UNVERIFIED: "Your Google account's email isn't verified. Verify it with Google or sign up with email.",
    ACCOUNT_UNAVAILABLE: "This account is not available. Please contact support.",
    AccessDenied: "Access was denied. Please try again.",
    OAuthSignin: "Couldn't start Google sign-in. Please try again.",
    OAuthCallback: "Google sign-in failed. Please try again.",
    Callback: "Sign-in failed. Please try again.",
    Configuration: "Sign-in is temporarily unavailable. Please try again later.",
    SessionRequired: "Please sign in to continue.",
  };
  return messages[code] ?? otpErrorMessage(code).message;
}
