import { describe, expect, it } from "vitest";
import { generateOtp, generateToken, hashOtp, sha256, verifyOtp } from "@/lib/auth/otp";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { loginSchema, passwordSchema, resetPasswordSchema, safeCallbackUrl, signupSchema } from "@/lib/validation";

describe("OTP primitives", () => {
  it("generates 6-digit numeric codes", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("produces unguessable URL-safe tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("stores codes as challenge-bound HMACs and verifies in constant time", () => {
    const id = sha256("token");
    const hash = hashOtp("123456", id);
    expect(hash).not.toContain("123456");
    expect(verifyOtp("123456", id, hash)).toBe(true);
    expect(verifyOtp("123457", id, hash)).toBe(false);
    // The same code for a different challenge must not verify.
    expect(verifyOtp("123456", sha256("other"), hash)).toBe(false);
  });
});

describe("password hashing", () => {
  it("hashes with bcrypt and verifies", async () => {
    const hash = await hashPassword("correct horse 1");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword("correct horse 1", hash)).toBe(true);
    expect(await verifyPassword("wrong horse 1", hash)).toBe(false);
  });

  it("still runs a comparison when there is no hash (timing equaliser)", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", undefined)).toBe(false);
  });
});

describe("validation schemas", () => {
  it("normalises email and enforces the password policy on signup", () => {
    const ok = signupSchema.safeParse({ name: " Ada ", email: " Ada@Example.COM ", password: "abc12345", confirmPassword: "abc12345" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.email).toBe("ada@example.com");
      expect(ok.data.name).toBe("Ada");
    }
    expect(signupSchema.safeParse({ name: "A", email: "a@b.co", password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "A", email: "a@b.co", password: "abcdefgh", confirmPassword: "abcdefgh" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "A", email: "a@b.co", password: "abc12345", confirmPassword: "abc12346" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "<script>", email: "a@b.co", password: "abc12345", confirmPassword: "abc12345" }).success).toBe(false);
  });

  it("rejects passwords over bcrypt's 72-byte limit", () => {
    expect(passwordSchema.safeParse(`a1${"é".repeat(40)}`).success).toBe(false);
  });

  it("rejects operator injection in login payloads", () => {
    expect(loginSchema.safeParse({ email: { $ne: null }, password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: { $gt: "" } }).success).toBe(false);
  });

  it("requires a 6-digit code and matching passwords for reset", () => {
    const base = { challengeToken: "x".repeat(43), password: "newpass123", confirmPassword: "newpass123" };
    expect(resetPasswordSchema.safeParse({ ...base, code: "123456" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ ...base, code: "12345" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, code: "abcdef" }).success).toBe(false);
  });

  it("only allows same-site relative callback URLs", () => {
    expect(safeCallbackUrl("/documents/1")).toBe("/documents/1");
    expect(safeCallbackUrl("https://evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("/api/me")).toBe("/dashboard");
    expect(safeCallbackUrl(null)).toBe("/dashboard");
  });
});
