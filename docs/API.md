# Scriptly.ai HTTP API

All endpoints are Next.js route handlers under `/api`. Bodies are JSON (`Content-Type: application/json` is required for
JSON endpoints). Authenticated endpoints use the NextAuth session cookie set by the sign-in flow.

## Conventions

- **Success:** `200`/`201` with `{ "data": … }`
- **Error:** `{ "error": { "code": "SOME_CODE", "message": "Human readable", "details"?: { … } } }`
  - `400 VALIDATION_ERROR` includes `details.fields` (`{ fieldName: message }`)
  - `401 UNAUTHENTICATED` / `401 SESSION_EXPIRED` — sign in again
  - `402 INSUFFICIENT_CREDITS` includes `details.required` / `details.available`
  - `403 FORBIDDEN_ORIGIN` — state-changing request from another origin
  - `404 NOT_FOUND` — also returned for resources owned by someone else
  - `429 RATE_LIMITED` (with `Retry-After`) and OTP-specific `429` codes
  - `503 SERVICE_UNAVAILABLE`, `AI_NOT_CONFIGURED`, `EMAIL_NOT_CONFIGURED`, `PAYMENTS_NOT_CONFIGURED`
  - Bot check (only when Turnstile is configured): `400 BOT_CHECK_REQUIRED`, `400 BOT_CHECK_FAILED`,
    `503 BOT_CHECK_UNAVAILABLE`, `503 BOT_CHECK_MISCONFIGURED`
- Stack traces and internal errors are never returned; they are logged server-side.
- Every state-changing request from a browser must come from the app's own origin.

## Authentication

| Method & path | Auth | Body | Result |
| --- | --- | --- | --- |
| `POST /api/auth/signup` | – | `name, email, password, confirmPassword, turnstileToken?` | `201` challenge `{ challengeToken, email, expiresAt, resendAvailableAt }`; code emailed. No account yet. `409 EMAIL_TAKEN` |
| `POST /api/auth/login` | – | `email, password, turnstileToken?` | challenge; code emailed. No session yet. `401 INVALID_CREDENTIALS` |
| `POST /api/auth/callback/otp` | – | form: `csrfToken, challengeToken, code` (NextAuth) | Sets the session cookie. Errors are returned as `?error=` codes: `CODE_INVALID:<attemptsLeft>`, `CODE_EXPIRED`, `CODE_USED`, `TOO_MANY_ATTEMPTS`, `CHALLENGE_NOT_FOUND`, `EMAIL_TAKEN`, `RATE_LIMITED` |
| `POST /api/auth/otp/resend` | – | `challengeToken` | new code; `429 RESEND_COOLDOWN` / `RESEND_LIMIT` |
| `POST /api/auth/password/forgot` | – | `email, turnstileToken?` | challenge (identical response for unknown emails) |
| `POST /api/auth/password/reset` | – | `challengeToken, code, password, confirmPassword` | `{ reset: true }`; all sessions revoked |
| `GET/POST /api/auth/*` | – | – | Standard NextAuth routes (`csrf`, `session`, `signout`, `providers`, `callback/google`) |

The browser uses `signIn("otp", { challengeToken, code })` from `next-auth/react` for the callback step.
`turnstileToken` is required on signup, login and forgot-password when `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` are set.

## Account

| Method & path | Body | Notes |
| --- | --- | --- |
| `GET /api/me` | – | `{ user, features: { ai, payments, email } }` |
| `PATCH /api/me` | `{ name }` | Unknown fields are rejected (credits/email/role can't be set) |
| `DELETE /api/me` | `{ confirmation: "DELETE", password? }` | Deletes account, documents, history; password required if one is set |
| `POST /api/me/email` | `{ newEmail, password? }` | Sends a code to the new address |
| `POST /api/me/email/verify` | `{ challengeToken, code }` | Switches the email; notifies the old address |
| `POST /api/me/password` | `{ currentPassword, newPassword, confirmPassword }` | Revokes every session (sign in again) |
| `DELETE /api/me/sessions` | – | Sign out everywhere |

## Templates & AI

| Method & path | Auth | Body / query | Notes |
| --- | --- | --- | --- |
| `GET /api/templates` | – | `?q=&category=` | Categories, templates (metadata only) and credit costs |
| `GET /api/templates/:id` | – | – | One template |
| `POST /api/generate` | ✓ | `{ templateId, inputs: {field: value}, settings: { language, tone, style?, length, framework?, creativity?, brandVoice?, instructions? }, requestId }` | Charges credits, returns `{ generation, credits, reused, truncated }`. Same `requestId` ⇒ same result, charged once. Failures are refunded |
| `POST /api/refine` | ✓ | `{ action, content, tone?, language?, templateId?, requestId }` | `action`: `improve, expand, shorten, rewrite, tone, grammar, continue, variants`. Returns `{ output, variants?, credits }` |

## Documents & history

| Method & path | Body / query | Notes |
| --- | --- | --- |
| `GET /api/documents` | `?q=&category=&sort=updated|created|title&order=asc|desc&page=&limit=` | Paginated, owner-only |
| `POST /api/documents` | `{ title?, content, templateId?, generationId?, language?, tone?, framework? }` | Title derived from content when omitted |
| `GET /api/documents/:id` | – | |
| `PATCH /api/documents/:id` | `{ title?, content?, baseUpdatedAt? }` | With `baseUpdatedAt`, a newer server copy returns `409 EDIT_CONFLICT` with `details.document` |
| `DELETE /api/documents/:id` | – | |
| `POST /api/documents/:id/duplicate` | – | |
| `GET /api/history` | `?kind=generate|refine|all&status=&category=&templateId=&page=&limit=` | Paginated generations (without full output) |
| `GET /api/history/:id` | – | Full output and inputs |
| `DELETE /api/history/:id` | – | Removes the item (documents unaffected) |
| `GET /api/dashboard` | – | Stats, recent items, 14-day usage, top templates |

## Credits & billing

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/credits` | ✓ | Balance, totals, price list |
| `GET /api/credits/transactions` | ✓ | `?type=&page=&limit=` ledger |
| `GET /api/packages` | – | Active packages, signup bonus, `paymentsEnabled` |
| `GET /api/orders` | ✓ | Recent orders (`status`, `fulfillmentStatus`, `refundedAmount`) |
| `POST /api/orders` | ✓ | `{ packageId }` → `{ orderId, checkout: { keyId, providerOrderId, amount, currency } }` |
| `POST /api/orders/:id/verify` | ✓ | Razorpay `razorpay_payment_id, razorpay_order_id, razorpay_signature`; verified + re-fetched before crediting |
| `POST /api/orders/:id/cancel` | ✓ | Marks an unpaid order cancelled |
| `POST /api/webhooks/razorpay` | signature | `X-Razorpay-Signature` HMAC of the raw body. `payment.captured`/`order.paid` fulfil (idempotent), `payment.failed` marks the order failed, `refund.created`/`refund.processed`/`refund.failed` reconcile refunds (idempotent). Permanent rejections return 200 with `error`; transient failures 500 so Razorpay retries |

## Rate limits (defaults)

| Scope | Limit |
| --- | --- |
| Signup | 10/hour per IP, 5/hour per email |
| Login (password step) | 20/15 min per IP, 10/15 min per email |
| Code verification | 30/15 min per IP; 5 attempts per code; 10 failures/hour and 20/day per email and purpose |
| Resend | 60 s cooldown, 5 sends per challenge, 20/hour per IP |
| Forgot password | 10/hour per IP, 5/hour per email |
| Verification emails per recipient | signup, reset, email change: 6/hour and 12/day each; sign-in: 10/hour and 30/day (first sends + resends; decoys count) |
| Generate + refine | 20/min and 500/day per user, 60/min per IP |
