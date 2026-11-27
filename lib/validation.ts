import { z } from "@/lib/zod";

/** Schemas shared by API routes and client forms. */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emailSchema = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .regex(EMAIL_PATTERN, "Enter a valid email address.");

export const nameSchema = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .max(80, "Name must be 80 characters or fewer.")
  .refine((v) => !/[\u0000-\u001f<>]/.test(v), "Name contains invalid characters.");

export const PASSWORD_RULES = "At least 8 characters, including a letter and a number.";

export const passwordSchema = z
  .string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  // bcrypt only uses the first 72 bytes of a password.
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password must be 72 bytes or fewer.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Password must include at least one letter and one number.");

export const otpCodeSchema = z
  .string({ error: "Enter the 6-digit code." })
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code.");

/** Cloudflare Turnstile response token (only checked when Turnstile is configured). */
export const botCheckTokenSchema = z.string().max(2048, "Security check token is invalid.").optional();

export const challengeTokenSchema = z
  .string({ error: "Verification session is missing." })
  .min(20, "Verification session is invalid.")
  .max(128, "Verification session is invalid.")
  .regex(/^[A-Za-z0-9_-]+$/, "Verification session is invalid.");

export const signupSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: "Please confirm your password." }),
    turnstileToken: botCheckTokenSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required." }).min(1, "Password is required.").max(200, "Password is too long."),
  turnstileToken: botCheckTokenSchema,
});

export const otpVerifySchema = z.object({
  challengeToken: challengeTokenSchema,
  code: otpCodeSchema,
});

export const resendSchema = z.object({ challengeToken: challengeTokenSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema, turnstileToken: botCheckTokenSchema });

export const resetPasswordSchema = z
  .object({
    challengeToken: challengeTokenSchema,
    code: otpCodeSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: "Please confirm your password." }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id.");

export const requestIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid request id.");

/** Escapes user input for safe use inside a RegExp (search boxes). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeCallbackUrl(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/api/")) return fallback;
  return value;
}
