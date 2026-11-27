"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AuthHeader, Field, FormAlert, PasswordInput } from "@/app/components/auth/AuthParts";
import { useBotCheck } from "@/app/components/auth/BotCheck";
import OtpStep, { type ChallengeInfo } from "@/app/components/auth/OtpStep";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { fieldErrors } from "@/lib/client/forms";
import { forgotPasswordSchema, passwordSchema } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const botCheck = useBotCheck("forgot_password");

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    if (!botCheck.ready) {
      setFormError("Please wait for the security check to finish.");
      return;
    }
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      setChallenge(await api<ChallengeInfo>("/api/auth/password/forgot", { body: { ...parsed.data, turnstileToken: botCheck.token } }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
      botCheck.reset(); // tokens are single-use
    }
  }

  async function reset(code: string): Promise<string | null> {
    if (!challenge) return "CHALLENGE_NOT_FOUND";
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) {
      setErrors({ password: pw.error.issues[0]?.message ?? "Choose a stronger password." });
      return "FIELD_ERROR";
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match." });
      return "FIELD_ERROR";
    }
    setErrors({});
    try {
      await api("/api/auth/password/reset", {
        body: { challengeToken: challenge.challengeToken, code, password, confirmPassword },
      });
      router.replace("/login?reset=1");
      return null;
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "VALIDATION_ERROR" && Object.keys(err.fields).length > 0) {
          setErrors(err.fields);
          return "FIELD_ERROR";
        }
        const remaining = err.details?.attemptsRemaining;
        return typeof remaining === "number" ? `${err.code}:${remaining}` : err.code;
      }
      return "SERVER_ERROR";
    }
  }

  if (challenge) {
    return (
      <OtpStep
        title="Reset your password"
        submitLabel="Reset password"
        challenge={challenge}
        onChallengeChange={setChallenge}
        onVerify={reset}
        onBack={() => setChallenge(null)}
        canSubmit={password.length > 0 && confirmPassword.length > 0}
      >
        <Field label="New password" htmlFor="new-password" error={errors.password} hint="At least 8 characters, including a letter and a number.">
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" invalid={Boolean(errors.password)} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-new-password" error={errors.confirmPassword}>
          <PasswordInput
            id="confirm-new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
          />
        </Field>
      </OtpStep>
    );
  }

  return (
    <div>
      <AuthHeader
        title="Forgot your password?"
        description="Enter the email you use for Scriptly. If there's an account, we'll send a code to reset your password."
      />
      <form onSubmit={requestCode} noValidate className="space-y-5">
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            placeholder="you@company.com"
            className="h-11"
            autoFocus
          />
        </Field>
        {botCheck.widget}
        {formError && <FormAlert>{formError}</FormAlert>}
        <Button type="submit" className="h-11 w-full" disabled={submitting || !botCheck.ready}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Send reset code
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-violet-300 underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
