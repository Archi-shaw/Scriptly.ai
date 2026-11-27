"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/app/components/ui/input-otp";
import { FormAlert, otpErrorMessage } from "@/app/components/auth/AuthParts";
import { api, ApiClientError } from "@/lib/client/api";

export interface ChallengeInfo {
  challengeToken: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
}

interface OtpStepProps {
  challenge: ChallengeInfo;
  onChallengeChange: (challenge: ChallengeInfo) => void;
  /** Resolves to an error code, or null when verification succeeded. */
  onVerify: (code: string) => Promise<string | null>;
  onBack: () => void;
  title: string;
  submitLabel: string;
  /** Extra inputs (e.g. new password); disables auto-submit when present. */
  children?: React.ReactNode;
  canSubmit?: boolean;
}

export default function OtpStep({
  challenge,
  onChallengeChange,
  onVerify,
  onBack,
  title,
  submitLabel,
  children,
  canSubmit = true,
}: OtpStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<{ message: string; restart?: boolean } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resendIn = Math.max(0, Math.ceil((new Date(challenge.resendAvailableAt).getTime() - now) / 1000));
  const expired = new Date(challenge.expiresAt).getTime() <= now;

  async function submit(value = code) {
    if (value.length !== 6 || verifying || !canSubmit) return;
    setVerifying(true);
    setError(null);
    try {
      const failure = await onVerify(value);
      if (failure === "FIELD_ERROR") {
        // The parent shows inline field errors; keep the code so the user can fix the field.
        setVerifying(false);
      } else if (failure) {
        setError(otpErrorMessage(failure));
        setCode("");
        setVerifying(false);
      }
      // On success the parent navigates away; keep the button busy meanwhile.
    } catch {
      setError({ message: "Something went wrong. Please try again." });
      setVerifying(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const next = await api<ChallengeInfo>("/api/auth/otp/resend", { body: { challengeToken: challenge.challengeToken } });
      onChallengeChange(next);
      setCode("");
      toast.success("We've sent you a new code.");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "CHALLENGE_NOT_FOUND") {
        setError({ message: err.message, restart: true });
      } else {
        setError({ message: err instanceof Error ? err.message : "Couldn't send a new code." });
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>

      <div className="mb-8">
        <span className="mb-4 grid size-12 place-items-center rounded-xl bg-primary/15 text-violet-300">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{challenge.email}</span>. It expires in a few
          minutes.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-6"
      >
        <div className="space-y-2">
          <label htmlFor="otp-code" className="text-sm font-medium">
            Verification code
          </label>
          <InputOTP
            id="otp-code"
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={(value) => {
              setCode(value);
              if (error && !error.restart) setError(null);
            }}
            onComplete={(value: string) => {
              if (!children) void submit(value);
            }}
            autoFocus
            autoComplete="one-time-code"
            disabled={verifying}
            containerClassName="justify-between"
          >
            <InputOTPGroup className="w-full justify-between gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  aria-invalid={error ? true : undefined}
                  className="h-14 w-12 rounded-lg border text-xl font-semibold first:rounded-lg last:rounded-lg sm:w-14"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {children}

        {error && (
          <FormAlert>
            {error.message}{" "}
            {error.restart && (
              <button type="button" onClick={onBack} className="font-medium underline underline-offset-4">
                Start again
              </button>
            )}
          </FormAlert>
        )}
        {expired && !error && <FormAlert tone="info">This code has expired. Request a new one below.</FormAlert>}

        <Button type="submit" className="h-11 w-full" disabled={code.length !== 6 || verifying || !canSubmit}>
          {verifying && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Didn&apos;t get it? Check your spam folder or{" "}
        {resendIn > 0 ? (
          <span>resend in {resendIn}s</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="font-medium text-violet-300 underline-offset-4 hover:underline disabled:opacity-60"
          >
            {resending ? "sending…" : "send a new code"}
          </button>
        )}
        .
      </p>
    </div>
  );
}
