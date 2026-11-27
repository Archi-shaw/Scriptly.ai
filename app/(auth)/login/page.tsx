"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  AuthHeader,
  Field,
  FormAlert,
  GoogleButton,
  PasswordInput,
  authRedirectError,
} from "@/app/components/auth/AuthParts";
import { useBotCheck } from "@/app/components/auth/BotCheck";
import OtpStep, { type ChallengeInfo } from "@/app/components/auth/OtpStep";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { fieldErrors } from "@/lib/client/forms";
import { loginSchema, safeCallbackUrl } from "@/lib/validation";

const REASONS: Record<string, string> = {
  "session-expired": "Your session ended. Please sign in again.",
  "password-changed": "Your password was changed. Sign in with your new password.",
  "signed-out-everywhere": "You've been signed out of all devices.",
  "account-deleted": "Your account has been deleted.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const reason = searchParams.get("reason");
  const passwordReset = searchParams.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(authRedirectError(searchParams.get("error")));
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const botCheck = useBotCheck("login");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
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
      setChallenge(await api<ChallengeInfo>("/api/auth/login", { body: { ...parsed.data, turnstileToken: botCheck.token } }));
    } catch (err) {
      if (err instanceof ApiClientError && Object.keys(err.fields).length > 0) setErrors(err.fields);
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
      botCheck.reset(); // tokens are single-use
    }
  }

  async function verify(code: string): Promise<string | null> {
    if (!challenge) return "CHALLENGE_NOT_FOUND";
    const result = await signIn("otp", { challengeToken: challenge.challengeToken, code, redirect: false });
    if (result?.ok && !result.error) {
      router.replace(callbackUrl);
      router.refresh();
      return null;
    }
    return result?.error ?? "SERVER_ERROR";
  }

  if (challenge) {
    return (
      <OtpStep
        title="Check your email"
        submitLabel="Verify and sign in"
        challenge={challenge}
        onChallengeChange={setChallenge}
        onVerify={verify}
        onBack={() => {
          setChallenge(null);
          setPassword("");
        }}
      />
    );
  }

  return (
    <div>
      <AuthHeader
        title="Welcome back"
        description={
          <>
            New to Scriptly?{" "}
            <Link href="/signup" className="font-medium text-violet-300 underline-offset-4 hover:underline">
              Create a free account
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        {reason && REASONS[reason] && <FormAlert tone="info">{REASONS[reason]}</FormAlert>}
        {passwordReset && <FormAlert tone="success">Your password has been reset. Sign in with your new password.</FormAlert>}
      </div>

      <div className="mt-6">
        <GoogleButton callbackUrl={callbackUrl} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          action={
            <Link href="/forgot-password" className="text-sm text-violet-300 underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(errors.password)} />
        </Field>

        {botCheck.widget}
        {formError && <FormAlert>{formError}</FormAlert>}

        <Button type="submit" className="h-11 w-full" disabled={submitting || !botCheck.ready}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Continue
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          For your security, we&apos;ll email you a one-time code to finish signing in.
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
