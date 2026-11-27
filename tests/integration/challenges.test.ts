import { expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email/mailer";
import { describeWithDb, useTestDatabase } from "../helpers/db";

const sent: EmailMessage[] = [];
vi.mock("@/lib/email/mailer", () => ({
  sendEmail: vi.fn(async (message: EmailMessage) => {
    sent.push(message);
  }),
  isEmailConfigured: () => true,
  EmailNotConfiguredError: class EmailNotConfiguredError extends Error {},
  EmailDeliveryError: class EmailDeliveryError extends Error {},
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void task(),
}));

const { createChallenge, resendChallenge, verifyChallenge } = await import("@/lib/auth/challenges");
const { sha256 } = await import("@/lib/auth/otp");
const { default: AuthChallenge } = await import("@/models/AuthChallenge");

function lastCode(to: string): string {
  const message = [...sent].reverse().find((m) => m.to === to);
  const code = message?.text.match(/Your code: (\d{6})/)?.[1];
  if (!code) throw new Error(`No code sent to ${to}`);
  return code;
}

const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describeWithDb("email verification challenges", () => {
  useTestDatabase();

  it("emails a code, stores only a hash, and verifies exactly once", async () => {
    const info = await createChallenge({ purpose: "login", email: "a@example.com", name: "A" });
    const code = lastCode("a@example.com");
    const stored = await AuthChallenge.findById(sha256(info.challengeToken)).lean();
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(JSON.stringify(stored)).not.toContain(info.challengeToken);

    const verified = await verifyChallenge(info.challengeToken, code, ["login"]);
    expect(verified.consumedAt).toBeTruthy();
    await expect(verifyChallenge(info.challengeToken, code, ["login"])).rejects.toMatchObject({ code: "CODE_USED" });
  });

  it("rejects wrong purposes, wrong codes and expired codes", async () => {
    const info = await createChallenge({ purpose: "signup", email: "b@example.com" });
    const code = lastCode("b@example.com");
    await expect(verifyChallenge(info.challengeToken, code, ["login"])).rejects.toMatchObject({ code: "CHALLENGE_NOT_FOUND" });
    await expect(verifyChallenge(info.challengeToken, wrong(code), ["signup"])).rejects.toMatchObject({
      code: "CODE_INVALID",
      details: { attemptsRemaining: 4 },
    });
    await AuthChallenge.updateOne({ _id: sha256(info.challengeToken) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyChallenge(info.challengeToken, code, ["signup"])).rejects.toMatchObject({ code: "CODE_EXPIRED" });
    await expect(verifyChallenge("x".repeat(43), "123456", ["signup"])).rejects.toMatchObject({ code: "CHALLENGE_NOT_FOUND" });
  });

  it("locks a challenge after 5 wrong attempts, even for the right code", async () => {
    const info = await createChallenge({ purpose: "login", email: "c@example.com" });
    const code = lastCode("c@example.com");
    for (let i = 0; i < 4; i++) {
      await expect(verifyChallenge(info.challengeToken, wrong(code), ["login"])).rejects.toMatchObject({ code: "CODE_INVALID" });
    }
    await expect(verifyChallenge(info.challengeToken, wrong(code), ["login"])).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    await expect(verifyChallenge(info.challengeToken, code, ["login"])).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });

  it("enforces the resend cooldown and invalidates the previous code", async () => {
    const info = await createChallenge({ purpose: "login", email: "d@example.com" });
    const oldCode = lastCode("d@example.com");
    await expect(resendChallenge(info.challengeToken)).rejects.toMatchObject({ code: "RESEND_COOLDOWN" });

    await AuthChallenge.updateOne({ _id: sha256(info.challengeToken) }, { $set: { lastSentAt: new Date(Date.now() - 61_000) } });
    await resendChallenge(info.challengeToken);
    const newCode = lastCode("d@example.com");
    if (newCode !== oldCode) {
      await expect(verifyChallenge(info.challengeToken, oldCode, ["login"])).rejects.toMatchObject({ code: "CODE_INVALID" });
    }
    await expect(verifyChallenge(info.challengeToken, newCode, ["login"])).resolves.toBeTruthy();
  });

  it("caps resends per challenge", async () => {
    const info = await createChallenge({ purpose: "login", email: "e@example.com" });
    for (let i = 0; i < 4; i++) {
      await AuthChallenge.updateOne({ _id: sha256(info.challengeToken) }, { $set: { lastSentAt: new Date(0) } });
      await resendChallenge(info.challengeToken);
    }
    await AuthChallenge.updateOne({ _id: sha256(info.challengeToken) }, { $set: { lastSentAt: new Date(0) } });
    await expect(resendChallenge(info.challengeToken)).rejects.toMatchObject({ code: "RESEND_LIMIT" });
  });

  it("keeps only the newest challenge per email and purpose", async () => {
    const first = await createChallenge({ purpose: "login", email: "f@example.com" });
    const firstCode = lastCode("f@example.com");
    await createChallenge({ purpose: "login", email: "f@example.com" });
    await expect(verifyChallenge(first.challengeToken, firstCode, ["login"])).rejects.toMatchObject({ code: "CHALLENGE_NOT_FOUND" });
  });

  it("caps failed guesses per email across challenges (brute-force protection)", async () => {
    for (let round = 0; round < 2; round++) {
      const info = await createChallenge({ purpose: "password_reset", email: "g@example.com", skipEmail: true });
      for (let i = 0; i < 5; i++) {
        await verifyChallenge(info.challengeToken, "000000", ["password_reset"]).catch(() => undefined);
      }
    }
    const info = await createChallenge({ purpose: "password_reset", email: "g@example.com", skipEmail: true });
    await expect(verifyChallenge(info.challengeToken, "000000", ["password_reset"])).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("decoy reset challenges send no email", async () => {
    const before = sent.length;
    await createChallenge({ purpose: "password_reset", email: "nobody@example.com", skipEmail: true });
    expect(sent.length).toBe(before);
  });

  it("wrong reset codes can't lock the owner out of signing in (caps are per purpose)", async () => {
    for (let round = 0; round < 3; round++) {
      const reset = await createChallenge({ purpose: "password_reset", email: "h@example.com", skipEmail: true });
      for (let i = 0; i < 5; i++) await verifyChallenge(reset.challengeToken, "000000", ["password_reset"]).catch(() => undefined);
    }
    const login = await createChallenge({ purpose: "login", email: "h@example.com" });
    await expect(verifyChallenge(login.challengeToken, lastCode("h@example.com"), ["login"])).resolves.toBeTruthy();
  });

  it("caps verification emails per recipient, whatever the source IP", async () => {
    const { EMAIL_QUOTAS } = await import("@/lib/auth/challenges");
    const email = "flood@example.com";
    const before = sent.filter((m) => m.to === email).length;
    for (let i = 0; i < EMAIL_QUOTAS.signup.hourly; i++) {
      await createChallenge({ purpose: "signup", email, ip: `203.0.113.${i}` });
    }
    await expect(createChallenge({ purpose: "signup", email, ip: "198.51.100.7" })).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
    expect(sent.filter((m) => m.to === email).length - before).toBe(EMAIL_QUOTAS.signup.hourly);
  });

  it("counts decoy reset requests like real ones, so a capped address reveals nothing", async () => {
    const { EMAIL_QUOTAS } = await import("@/lib/auth/challenges");
    for (const email of ["ghost@example.com", "member@example.com"]) {
      for (let i = 0; i < EMAIL_QUOTAS.password_reset.hourly; i++) {
        await createChallenge({ purpose: "password_reset", email, skipEmail: email === "ghost@example.com", sendInBackground: true });
      }
      await expect(createChallenge({ purpose: "password_reset", email, skipEmail: email === "ghost@example.com" })).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
      });
    }
  });

  it("reset floods don't use up the owner's sign-in email allowance", async () => {
    const { EMAIL_QUOTAS } = await import("@/lib/auth/challenges");
    const email = "owner@example.com";
    for (let i = 0; i < EMAIL_QUOTAS.password_reset.hourly; i++) {
      await createChallenge({ purpose: "password_reset", email, sendInBackground: true });
    }
    await expect(createChallenge({ purpose: "password_reset", email })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(createChallenge({ purpose: "login", email })).resolves.toBeTruthy();
  });

  it("a capped recipient keeps the code they already have when resending", async () => {
    const { EMAIL_QUOTAS } = await import("@/lib/auth/challenges");
    const email = "resend-cap@example.com";
    let info = await createChallenge({ purpose: "signup", email });
    // Use up the hourly allowance with resends.
    for (let i = 1; i < EMAIL_QUOTAS.signup.hourly; i++) {
      if (i % 4 === 0) {
        info = await createChallenge({ purpose: "signup", email }); // stay under the per-session resend cap
      } else {
        await AuthChallenge.updateOne({ _id: sha256(info.challengeToken) }, { $set: { lastSentAt: new Date(0) } });
        await resendChallenge(info.challengeToken);
      }
    }
    const code = lastCode(email);
    await AuthChallenge.updateOne({ _id: sha256(info.challengeToken) }, { $set: { lastSentAt: new Date(0) } });
    await expect(resendChallenge(info.challengeToken)).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    await expect(verifyChallenge(info.challengeToken, code, ["signup"])).resolves.toBeTruthy();
  });

  it("doesn't put user-typed names into emails sent to unverified addresses", async () => {
    await createChallenge({ purpose: "signup", email: "new@example.com", name: "Win a prize at evil.example" });
    const signupMail = [...sent].reverse().find((m) => m.to === "new@example.com")!;
    expect(signupMail.text).not.toContain("evil.example");
    expect(signupMail.html).not.toContain("evil.example");

    await createChallenge({ purpose: "login", email: "known@example.com", name: "Ada" });
    expect([...sent].reverse().find((m) => m.to === "known@example.com")!.text).toContain("Hi Ada,");
  });
});
