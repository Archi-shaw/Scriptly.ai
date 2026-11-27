"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { BadgeCheck, KeyRound, Loader2, LogOut, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/app/components/ui/input-otp";
import { ConfirmDialog, PageContainer, PageHeader } from "@/app/components/app/primitives";
import { Field, FormAlert, PasswordInput } from "@/app/components/auth/AuthParts";
import type { ChallengeInfo } from "@/app/components/auth/OtpStep";
import { useMe } from "@/app/hooks/use-me";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatDate, formatNumber } from "@/lib/format";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfileTab() {
  const { data: me, mutate: refreshMe } = useMe();
  const { update } = useSession();
  const user = me?.user;
  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);

  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [emailBusy, setEmailBusy] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [code, setCode] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return;
    }
    setNameError(undefined);
    setSavingName(true);
    try {
      await api("/api/me", { method: "PATCH", body: { name: parsed.data } });
      await Promise.all([refreshMe(), update()]);
      toast.success("Name updated");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update your name."));
    } finally {
      setSavingName(false);
    }
  }

  async function requestEmailChange(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      setEmailErrors({ newEmail: parsed.error.issues[0]?.message ?? "Enter a valid email." });
      return;
    }
    if (user?.hasPassword && !password) {
      setEmailErrors({ password: "Enter your current password." });
      return;
    }
    setEmailErrors({});
    setEmailMessage(null);
    setEmailBusy(true);
    try {
      setChallenge(await api<ChallengeInfo>("/api/me/email", { body: { newEmail: parsed.data, password: password || undefined } }));
      setPassword("");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INVALID_PASSWORD") setEmailErrors({ password: err.message });
      else setEmailMessage(errorMessage(err));
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmEmailChange(value = code) {
    if (!challenge || value.length !== 6) return;
    setEmailBusy(true);
    setEmailMessage(null);
    try {
      await api("/api/me/email/verify", { body: { challengeToken: challenge.challengeToken, code: value } });
      await Promise.all([refreshMe(), update()]);
      toast.success("Email address updated");
      setChallenge(null);
      setChangingEmail(false);
      setNewEmail("");
      setCode("");
    } catch (err) {
      setEmailMessage(errorMessage(err));
      setCode("");
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Profile" description="How your name appears in Scriptly.">
        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
          <div className="flex-1">
            <Field label="Full name" htmlFor="profile-name" error={nameError}>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" aria-invalid={nameError ? true : undefined} />
            </Field>
          </div>
          <Button type="submit" className="sm:mt-[22px]" disabled={savingName || name.trim() === user?.name}>
            {savingName && <Loader2 className="animate-spin" aria-hidden />}
            Save
          </Button>
        </form>
      </Section>

      <Section title="Email address" description="Used to sign in and to receive verification codes.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <Mail className="size-4 text-muted-foreground" aria-hidden />
            <span className="font-medium">{user?.email}</span>
            {user?.emailVerified && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                <BadgeCheck className="size-3.5" aria-hidden /> Verified
              </span>
            )}
          </p>
          {!changingEmail && (
            <Button variant="outline" size="sm" onClick={() => setChangingEmail(true)}>
              Change email
            </Button>
          )}
        </div>

        {changingEmail && !challenge && (
          <form onSubmit={requestEmailChange} className="mt-5 space-y-4 border-t border-border pt-5" noValidate>
            <Field label="New email address" htmlFor="new-email" error={emailErrors.newEmail}>
              <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" aria-invalid={emailErrors.newEmail ? true : undefined} />
            </Field>
            {user?.hasPassword && (
              <Field label="Current password" htmlFor="email-password" error={emailErrors.password}>
                <PasswordInput id="email-password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(emailErrors.password)} />
              </Field>
            )}
            {emailMessage && <FormAlert>{emailMessage}</FormAlert>}
            <div className="flex gap-2">
              <Button type="submit" disabled={emailBusy}>
                {emailBusy && <Loader2 className="animate-spin" aria-hidden />}
                Send verification code
              </Button>
              <Button type="button" variant="ghost" onClick={() => setChangingEmail(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {changingEmail && challenge && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmEmailChange();
            }}
            className="mt-5 space-y-4 border-t border-border pt-5"
          >
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code we sent to <span className="font-medium text-foreground">{challenge.email}</span>.
            </p>
            <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={code} onChange={setCode} onComplete={(v: string) => void confirmEmailChange(v)} autoComplete="one-time-code" disabled={emailBusy}>
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="h-12 w-11 rounded-lg border text-lg first:rounded-lg last:rounded-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {emailMessage && <FormAlert>{emailMessage}</FormAlert>}
            <div className="flex gap-2">
              <Button type="submit" disabled={emailBusy || code.length !== 6}>
                {emailBusy && <Loader2 className="animate-spin" aria-hidden />}
                Confirm new email
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setChallenge(null);
                  setCode("");
                  setEmailMessage(null);
                }}
              >
                Back
              </Button>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}

function SecurityTab() {
  const { data: me } = useMe();
  const user = me?.user;
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.currentPassword) next.currentPassword = "Enter your current password.";
    const pw = passwordSchema.safeParse(form.newPassword);
    if (!pw.success) next.newPassword = pw.error.issues[0]?.message ?? "Choose a stronger password.";
    if (form.newPassword !== form.confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api("/api/me/password", { body: form });
      toast.success("Password changed. Please sign in again.");
      await signOut({ callbackUrl: "/login?reason=password-changed" });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INVALID_PASSWORD") setErrors({ currentPassword: err.message });
      else if (err instanceof ApiClientError && Object.keys(err.fields).length) setErrors(err.fields);
      else toast.error(errorMessage(err, "Couldn't change your password."));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Password" description="Changing your password signs you out on every device.">
        {user?.hasPassword ? (
          <form onSubmit={changePassword} className="max-w-md space-y-4" noValidate>
            <Field label="Current password" htmlFor="current-password" error={errors.currentPassword}>
              <PasswordInput id="current-password" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} autoComplete="current-password" invalid={Boolean(errors.currentPassword)} />
            </Field>
            <Field label="New password" htmlFor="new-password" error={errors.newPassword} hint="At least 8 characters, including a letter and a number.">
              <PasswordInput id="new-password" value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} autoComplete="new-password" invalid={Boolean(errors.newPassword)} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password" error={errors.confirmPassword}>
              <PasswordInput id="confirm-password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Change password
            </Button>
          </form>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>You sign in with Google, so your account doesn&apos;t have a password yet.</p>
            <p>
              To add one, request a reset code for <span className="font-medium text-foreground">{user?.email}</span> — you&apos;ll then be able to
              sign in with email and password too.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/forgot-password">Set a password</Link>
            </Button>
          </div>
        )}
      </Section>

      <Section title="Sign-in methods">
        <ul className="space-y-3 text-sm">
          <li className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden /> Email &amp; password with email code
            </span>
            <span className={user?.hasPassword ? "text-emerald-300" : "text-muted-foreground"}>{user?.hasPassword ? "Enabled" : "Not set up"}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" aria-hidden /> Google
            </span>
            <span className={user?.googleLinked ? "text-emerald-300" : "text-muted-foreground"}>{user?.googleLinked ? "Linked" : "Not linked"}</span>
          </li>
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden />
          Two-step verification is always on: every password sign-in also needs a one-time code sent to your email.
        </p>
      </Section>

      <Section title="Sessions" description="Signed in on a shared or lost device? Sign out everywhere, including here.">
        <Button variant="outline" onClick={() => setConfirmSignOut(true)}>
          <LogOut aria-hidden /> Sign out of all devices
        </Button>
      </Section>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of all devices?"
        description="Every session — including this one — will be signed out. You'll need to sign in again."
        confirmLabel="Sign out everywhere"
        onConfirm={async () => {
          try {
            await api("/api/me/sessions", { method: "DELETE" });
            await signOut({ callbackUrl: "/login?reason=signed-out-everywhere" });
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function AccountTab() {
  const { data: me } = useMe();
  const { mutate } = useSWRConfig();
  const user = me?.user;
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Section title="Account details">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="mt-1 font-medium">{formatDate(user?.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="mt-1 font-medium">Pay as you go (credits)</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credit balance</dt>
            <dd className="mt-1 font-medium">
              {formatNumber(user?.credits ?? 0)} ·{" "}
              <Link href="/billing" className="text-violet-300 hover:underline">
                Buy credits
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credits used to date</dt>
            <dd className="mt-1 font-medium">{formatNumber(user?.totalCreditsUsed ?? 0)}</dd>
          </div>
        </dl>
      </Section>

      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6">
        <h2 className="font-semibold text-red-200">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently deletes your account, documents and generation history. Remaining credits are forfeited. This can&apos;t be undone.
        </p>
        <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden /> Delete my account
        </Button>
      </section>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setConfirmation("");
            setPassword("");
            setError(null);
          }
        }}
        title="Delete your account permanently?"
        description="All documents and history will be erased immediately. This cannot be undone."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          if (confirmation !== "DELETE") {
            setError('Type "DELETE" to confirm.');
            return;
          }
          if (user?.hasPassword && !password) {
            setError("Enter your password to confirm.");
            return;
          }
          setError(null);
          try {
            await api("/api/me", { method: "DELETE", body: { confirmation, password: password || undefined } });
            void mutate(() => true, undefined, { revalidate: false });
            await signOut({ callbackUrl: "/login?reason=account-deleted" });
          } catch (err) {
            setError(errorMessage(err, "Couldn't delete your account."));
          }
        }}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input id="delete-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
          </div>
          {user?.hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="delete-password">Password</Label>
              <PasswordInput id="delete-password" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
          )}
          {error && <FormAlert>{error}</FormAlert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = ["profile", "security", "account"].includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "profile";
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Manage your profile, security and account." />
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
