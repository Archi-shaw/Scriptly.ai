# Scriptly.ai — Production Readiness Report

_2026-11-27 · V1 release preparation_

**Verdict: code-complete for V1, not yet production-ready.** Every automated check passes, and the V1 security gaps
(Content-Security-Policy, OTP email abuse) are closed. But OpenAI, your SMTP provider and Razorpay have only run
against local stand-ins, and Turnstile only with Cloudflare's test keys. Production readiness depends on the live tests
in **[docs/INTEGRATION_TESTING.md](docs/INTEGRATION_TESTING.md)**, tracked in the sign-off table of
**[docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)**.

| Document | Use it for |
| --- | --- |
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | What blocks launch vs what can wait, the step-by-step checklist, launch-day runbook, sign-off |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production configuration: every variable, MongoDB, OpenAI, SMTP, Razorpay, Turnstile, hosting |
| [docs/INTEGRATION_TESTING.md](docs/INTEGRATION_TESTING.md) | Exact live tests for OpenAI, SMTP, Razorpay (capture, success, failure, refunds), Turnstile/CSP |

---

## Changes in the V1 preparation pass

| Area | Change |
| --- | --- |
| **Content-Security-Policy** | Every page now gets a per-request nonce policy from `middleware.ts` (`lib/security/csp.ts`): scripts only with the nonce plus `'strict-dynamic'` (no `unsafe-inline`/`unsafe-eval` in production), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action` restricted, frames limited to Razorpay and Cloudflare Turnstile, and `upgrade-insecure-requests` on HTTPS. Optional `CSP_REPORT_URI` and `CSP_REPORT_ONLY`. Pages render per request so each carries its nonce. Zod's eval-based JIT is disabled via `lib/zod.ts` (it would trip the CSP), and ESLint blocks importing `zod` directly. |
| **OTP abuse protection** | Per-recipient caps on verification emails, counted on first sends and resends and per purpose: signup, reset and email-change 6/hour and 12/day; sign-in 10/hour and 30/day. Decoy resets count too, so caps reveal nothing. A capped resend keeps the current code valid. Failed-guess caps are now per purpose, so wrong reset codes can't lock an owner out of signing in. Signup and email-change emails no longer include user-typed names, which closes a spam-relay vector. Email addresses are hashed in rate-limit keys. |
| **Bot check** | Optional Cloudflare Turnstile on signup, login and forgot-password (`TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, read at runtime). Verified server-side; fails closed; refuses half-configuration; rejects tokens issued for another form. |
| **Refund reconciliation** | `refund.created`/`refund.processed` webhooks record the refund on the order and take back the matching share of credits. Shares are split exactly across partial refunds and never go below zero (spent credits are reported as a shortfall). `refund.failed` restores them. A fully refunded order becomes **Refunded**, and a late capture retry can't re-credit it. New ledger type `reversal`; the billing page shows refunds. All idempotent, safe for duplicates and out-of-order delivery. |
| **Ops** | `npm run email:test -- you@example.com` sends through the real mailer with production TLS rules. |
| **Legal copy** | Terms explain what happens to credits when a payment is refunded; Privacy mentions the bot-check provider. |
| **Docs** | New deployment, live-testing and launch-checklist guides; README, `.env.example`, API and database docs updated. |

## Verification evidence (after all changes)

| Check | Result |
| --- | --- |
| `npm audit` | **0 vulnerabilities** |
| `npm run typecheck` · `npm run lint` | pass · pass (0 warnings) |
| Unit + integration (`TEST_MONGODB_URI`, MongoDB 8 replica set) | **111/111** (was 86). New: CSP builder, Turnstile verification (mocked Cloudflare), per-recipient quotas, decoy counting, per-purpose lockout, capped resends, unverified-email copy, refund reconciliation (full, partial, concurrent, shortfall, failure restore, out-of-order, unfulfilled, mismatch) |
| `npm run build` | pass; every page is dynamic (ƒ) as nonces require |
| `npm run test:e2e` (production build, real HTTP, MongoDB, SMTP to a local sink, mock AI) | **32/32** (was 29). New: a fresh nonce on 7 pages, with **every** `<script>` carrying it; no CSP on JSON APIs; signed refund webhooks reconcile once; a late capture retry doesn't re-credit |
| Headless Google Chrome 158 on the production build, Cloudflare's **real** Turnstile service with its published test keys, Razorpay's **real** `checkout.js` | **10/10** steps, **0 CSP violations** on 14 pages. Turnstile renders and issues a token on signup, login and forgot-password; the server verified tokens with Cloudflare (always-pass secret: flows completed; always-fail secret: signup refused with a clear message); Razorpay Checkout loaded and opened its `api.razorpay.com` frame. The only errors were Razorpay rejecting the deliberately fake key (`401` from `api.razorpay.com`) and a deliberate 404 |
| `npm run email:test` against a local SMTP server | Refuses plaintext by default; sends when TLS is explicitly not required |

What these checks **don't** prove: that your OpenAI key and model work, that your SMTP provider delivers to inboxes,
that a real Razorpay test payment completes (the checkout above used a fake order), and that your real Turnstile widget
works on your hostname.

---

## 1. Implemented and verified locally

| Capability | Verified by |
| --- | --- |
| Landing page, navigation, DB-backed pricing, legal pages | E2E + headless Chrome (desktop and 375 px) |
| Signup → emailed code → account created only after verification → signup credits | E2E (SMTP to a local sink) + browser |
| Login: password, then emailed code; **a password alone never creates a session** | E2E + browser |
| Code security: hashed codes, 5 attempts per code, resend cooldown, per-purpose failure caps, **per-recipient email quotas** | Integration + E2E |
| Bot check (Turnstile) on signup/login/reset, fail-closed | Unit (mocked) + browser against Cloudflare with test keys |
| Forgot/reset password without account enumeration | E2E + integration (decoys counted identically) |
| Session revocation; email change; password change; account deletion | E2E + browser |
| Route protection (middleware + DB-checked layout and API guards) | E2E |
| **Content-Security-Policy** with per-request nonces | Unit + E2E + browser (0 violations) |
| 83 template prompts, 39 languages, 14 tones, styles, AIDA/PAS/BAB | Unit + prompt audit + E2E |
| Generation, 8 editor actions, variants, regenerate, history | E2E + browser (mock model) |
| Credits: atomic, never negative, idempotent, automatic refunds, ledger | Integration (concurrency; replica set and standalone) + E2E |
| Documents: autosave, conflict detection, rename, duplicate, delete, search | E2E + browser |
| Authorization: no IDOR, CSRF origin check, mass-assignment and operator-injection rejection | E2E |
| Payment fulfilment: signatures, amount/currency/order matching, exactly-once crediting | Unit + integration + E2E |
| **Refund reconciliation** from webhooks | Integration (9 tests) + E2E (signed webhooks) |

## 2. Implemented, awaiting a live test with your credentials

| Integration | Variables | What was verified | Live test |
| --- | --- | --- | --- |
| **OpenAI** | `OPENAI_API_KEY` (+ optional `OPENAI_MODEL` = `gpt-6-luna`, `OPENAI_REASONING_EFFORT` = `none`, `OPENAI_TIMEOUT_MS`, `OPENAI_BASE_URL`) | Contract and error handling with mocked HTTP; a real call with an invalid key mapped to `AI_AUTH_FAILED` | [Testing §1](docs/INTEGRATION_TESTING.md#1-openai-generation-with-a-real-api-key): whether the default model generates well with your key is **unverified** |
| **SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (+ `SMTP_SECURE`, `SMTP_REQUIRE_TLS`) | Real SMTP through nodemailer to a local server; plaintext and untrusted certificates refused | [Testing §2](docs/INTEGRATION_TESTING.md#2-smtp-delivery-with-your-email-provider): TLS/auth with your provider, inbox placement |
| **Razorpay** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` + webhook with 6 events | Locally signed webhooks (payments and refunds); order creation and payment fetch with mocked HTTP; real `checkout.js` loads under the CSP | [Testing §3](docs/INTEGRATION_TESTING.md#3-razorpay-test-mode-checkout-capture-success-failure-refunds): real checkout, automatic capture, failures, refunds, then live mode |
| **Turnstile** | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare's real service with test keys (pass and fail) | [Testing §4](docs/INTEGRATION_TESTING.md#4-bot-check-csp-and-security-headers-on-the-deployed-site) with your widget on your hostname |
| **Google sign-in** (optional) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Account linking logic (integration) | [Testing §5](docs/INTEGRATION_TESTING.md#5-google-sign-in-only-if-enabled): the OAuth flow has never run |

## 3. Not implemented

Honest list of what V1 does **not** include. See [LAUNCH_CHECKLIST.md §1–2](docs/LAUNCH_CHECKLIST.md) for which of these block a launch.

- **Refund/cancellation policy and contact page content.** The refund *mechanics* exist; the *policy* is a business
  decision.
- **Tax invoices** (e.g. GST) and Scriptly-issued purchase receipts. Razorpay can send payment receipts.
- **Admin console** for users, orders, packages or suspensions. Use the CLI scripts and the Razorpay Dashboard.
- **Refund initiation from the app.** Refunds are issued in Razorpay; the app only reconciles them.
- **Error tracking/alerting** (e.g. Sentry) and product analytics. Logs go to stdout.
- **Personal data export** ("download my data").
- **Re-authentication** before sensitive actions for Google-only accounts.
- **Subscriptions**, **streaming** AI output, **teams**, **document version history**, **plagiarism checks**,
  native **`.docx`** export, **disposable-email blocking**.

## 4. Known limitations

- **Spent credits can't be clawed back.** A refund takes back at most the current balance; the rest is logged as a
  shortfall for you to handle.
- **`refund.failed` can't be triggered in Razorpay test mode**; its restore path is covered by integration tests only.
- **The bot check depends on Cloudflare.** It fails closed, so a Cloudflare outage blocks signup, login and reset until
  you unset both `TURNSTILE_*` variables (see the rollback table in the checklist).
- **No static page caching.** Every page renders per request so it can carry its CSP nonce. This is fine at V1 scale;
  revisit with a CDN strategy if traffic grows.
- **The CSP allows inline styles** (`style-src 'unsafe-inline'`), which React style props, Radix positioning and toasts
  need. Scripts remain nonce-only.
- **Per-recipient quotas can delay a legitimate user** whose address is being flooded, for up to an hour (signup/reset)
  or a day at worst. Sign-in codes have their own, larger allowance.
- Fixed-format ad templates produce fixed counts; Short/Medium/Long only changes copy length.
- Word export is Word-compatible HTML (`.doc`); PDF uses the browser's print dialog.
- Usage chart buckets by UTC day. Document search is a case-insensitive scan, not ranked full-text search.
- Generation can take up to 120 s (`maxDuration`); your host must allow it.
- Tests need Node 22.12+ (Vitest 5); the app needs Node 20.9+.

## 5. Remaining security risks

| Risk | Severity | Mitigation in place | Recommendation |
| --- | --- | --- | --- |
| Email flooding across many addresses with rotating IPs | Low with Turnstile on; medium without | Per-recipient quotas, per-IP limits, no user text in emails to unverified addresses, optional Turnstile | Enable Turnstile in production (a launch blocker in the checklist) |
| Password-reset codes guessed slowly (6 digits) | Low | 5 attempts per code; 10 failures/hour and 20/day per address for resets; the owner is emailed each code | Accept, or move resets to longer codes or links |
| IP rate limits trust `x-forwarded-for` / `x-real-ip` | Low-medium | Per-email and per-user limits don't depend on IP | Deploy behind Vercel or a proxy that overwrites these headers |
| Google-only accounts change email or delete without re-authentication | Low-medium | Active session required; the old address is notified | Require a recent sign-in (deferred) |
| No per-user rate limit on authenticated read/CRUD endpoints | Low | Auth required; owner-scoped, indexed queries | Platform rate limiting / WAF |
| `style-src 'unsafe-inline'` | Low | Scripts are nonce-only; no `dangerouslySetInnerHTML`; Markdown never renders raw HTML | Accept for V1 |
| JWT sessions last up to 7 days | Low | Every request re-checks the user and session version in MongoDB | Shorten `SESSION_MAX_AGE_DAYS` if needed |
| Secret rotation | Operational | — | Rotating `NEXTAUTH_SECRET` signs everyone out; rotate the Razorpay webhook secret in a quiet period |
| Future Next 15 advisories may only be fixed in Next 16 | Operational | 0 advisories today | Schedule the upgrade |
