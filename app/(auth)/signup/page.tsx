"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AuthHeader, Field, FormAlert, GoogleButton, PasswordInput } from "@/app/components/auth/AuthParts";
import { useBotCheck } from "@/app/components/auth/BotCheck";
import OtpStep, { type ChallengeInfo } from "@/app/components/auth/OtpStep";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { fieldErrors } from "@/lib/client/forms";
import { PASSWORD_RULES, signupSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "A letter", ok: /[A-Za-z]/.test(password) },
    { label: "A number", ok: /\d/.test(password) },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
      {rules.map((rule) => (
        <li key={rule.label} className={cn("flex items-center gap-1", rule.ok ? "text-emerald-400" : "text-muted-foreground")}>
          <Check className={cn("size-3.5", !rule.ok && "opacity-40")} aria-hidden />
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const botCheck = useBotCheck("signup");

  const update = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
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
      setChallenge(await api<ChallengeInfo>("/api/auth/signup", { body: { ...parsed.data, turnstileToken: botCheck.token } }));
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
    // Verifying the code creates the account and signs the user in.
    const result = await signIn("otp", { challengeToken: challenge.challengeToken, code, redirect: false });
    if (result?.ok && !result.error) {
      router.replace("/dashboard?welcome=1");
      router.refresh();
      return null;
    }
    return result?.error ?? "SERVER_ERROR";
  }

  if (challenge) {
    return (
      <OtpStep
        title="Verify your email"
        submitLabel="Verify and create account"
        challenge={challenge}
        onChallengeChange={setChallenge}
        onVerify={verify}
        onBack={() => setChallenge(null)}
      />
    );
  }

  return (
    <div>
      <AuthHeader
        title="Create your account"
        description={
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-violet-300 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        }
      />

      <GoogleButton callbackUrl="/dashboard?welcome=1" label="Sign up with Google" />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => update("name")(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
            placeholder="Ada Lovelace"
            className="h-11"
            autoFocus
          />
        </Field>
        <Field label="Work email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email")(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            placeholder="you@company.com"
            className="h-11"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={update("password")}
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            placeholder={PASSWORD_RULES}
          />
        </Field>
        <PasswordChecklist password={form.password} />
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            value={form.confirmPassword}
            onChange={update("confirmPassword")}
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
          />
        </Field>

        {botCheck.widget}
        {formError && <FormAlert>{formError}</FormAlert>}

        <Button type="submit" className="h-11 w-full" disabled={submitting || !botCheck.ready}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Create account
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
