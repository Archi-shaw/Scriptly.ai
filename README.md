# Scriptly.ai — AI content generation workspace

Scriptly.ai helps creators, marketers and businesses produce high-quality written content with AI. Pick one of **83 templates**
(blog posts, SEO, social, ads, email, e-commerce, website copy, business documents, video scripts…), describe what you need,
choose the **language, tone, style, length and copywriting framework (AIDA / PAS / BAB)**, and Scriptly writes a draft you can
edit, refine with AI, save, and export.

> Built under **GannaG TechVentures**.

---

## Features

| Area | What you get |
| --- | --- |
| **AI generation** | 83 templates in 11 categories, each with its own inputs and server-side prompt instructions · 39 languages (written natively, not translated) · 14 tones · 9 writing styles · 3 creativity levels · length control · AIDA, PAS and BAB frameworks · brand information and extra instructions |
| **Editor** | Markdown editor with preview · AI tools on the whole document or the selected text: improve, expand, shorten, rewrite, change tone, fix grammar, continue writing, 3 alternative versions · undo · copy · export to Markdown, text, HTML, Word (.doc) or PDF (print) · autosave with conflict detection and local draft recovery |
| **Workspace** | Dashboard with real usage data · template library with search, category filters and details · My Documents (search, filter, sort, rename, duplicate, delete, blank documents) · paginated generation history (view, reopen, regenerate, delete) |
| **Accounts** | Email + password signup with emailed 6-digit verification code (the account is created only after verification) · **two-step login**: password, then an emailed code · forgot/reset password · change email (verified), change password, sign out of all devices, delete account · optional Google sign-in |
| **Credits & billing** | Free signup credits · server-side, atomic, idempotent credit accounting with a full ledger · automatic refunds for failed generations · credit packages stored in MongoDB · Razorpay checkout with signature verification and webhooks · automatic reconciliation of refunds issued in Razorpay |
| **Security** | Hashed passwords (bcrypt, cost 12) and HMAC-hashed one-time codes · expiring, single-use codes with attempt limits and resend cooldowns · per-recipient email quotas · optional Cloudflare Turnstile bot check · MongoDB-backed rate limiting · encrypted HttpOnly session cookies with server-side revocation · ownership checks on every resource · same-origin checks on state-changing requests · nonce-based Content-Security-Policy and security headers |

## Tech stack

- **Next.js 15** (App Router, route handlers, middleware) · **React 19** · **TypeScript**
- **Tailwind CSS 4** · shadcn/ui components on Radix primitives · Lucide icons · Sonner toasts · SWR
- **MongoDB** with **Mongoose 8**
- **NextAuth 4** (JWT session strategy) for sessions; custom OTP challenge flow for verification
- **OpenAI** Chat Completions API behind a provider interface (swappable)
- **Nodemailer** (SMTP) for transactional email · **Razorpay** for payments (optional)
- **Zod** for validation (shared by client and server) · **Vitest** for tests

## Project structure

```
app/
  (auth)/            login, signup, forgot-password (+ shared auth layout)
  (app)/             authenticated workspace: dashboard, write, templates, documents, history, billing, settings
  api/               route handlers (auth, me, generate, refine, documents, history, credits, packages, orders, webhooks…)
  components/
    Landing/         marketing site sections
    Essentials/      Logo, workspace sidebar
    app/ auth/ editor/ writer/   feature components
    ui/              shadcn/ui primitives
  hooks/             client hooks (useMe, useDebounced, useIsMobile)
lib/
  ai/                provider interface, OpenAI provider, prompt builder, template instructions (server-only)
  auth/              NextAuth options, OTP challenges + email quotas, Turnstile check, accounts, password hashing, session guards
  email/             SMTP mailer + email templates
  payments/          payment provider interface + Razorpay implementation
  templates/         template registry, generation options, input validation (shared)
  security/          Content-Security-Policy builder
  client/            browser helpers (API client, exports, Razorpay loader)
  credits.ts generation.ts orders.ts refunds.ts packages.ts rate-limit.ts zod.ts api.ts config.ts db.ts …
models/              Mongoose schemas
middleware.ts        per-request CSP nonce; redirects signed-out visitors away from workspace pages
scripts/             seed, admin credit adjustment, SMTP test email, end-to-end test runner
tests/               unit, integration (MongoDB) and end-to-end suites + test-only mock servers
docs/                API and database reference, deployment, live integration tests, launch checklist
```

## Getting started

### Prerequisites

- Node.js **20.9+** to run the app (**22.12+** to run the test suite) and npm
- MongoDB 6+ — a local `mongod`, Docker, or a free MongoDB Atlas cluster
- An OpenAI API key (required to generate content)
- SMTP credentials (required in production; optional in development, see below)

### 1. Install

```bash
git clone https://github.com/Archi-shaw/Scriptly.ai.git
cd Scriptly.ai
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in at least `MONGODB_URI`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`) and `OPENAI_API_KEY`.
Every variable is documented in [`.env.example`](.env.example):

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string (`MONGODB_URL` also accepted) |
| `NEXTAUTH_URL` | yes | Public base URL of the app |
| `NEXTAUTH_SECRET` | yes | Encrypts sessions and keys the OTP hashes — keep it secret and stable |
| `OPENAI_API_KEY` | for AI | Without it the app works but generation is disabled with a clear message |
| `OPENAI_MODEL` | no | Defaults to `gpt-6-luna` (`gpt-4o-mini` shuts down on 2027-01-14) |
| `OPENAI_REASONING_EFFORT` | no | Defaults to `none`; `low`/`medium`/`high` for reasoning, `auto` to omit |
| `OPENAI_BASE_URL`, `OPENAI_TIMEOUT_MS` | no | Endpoint override (OpenAI-compatible), request timeout (default 90 s) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | production | Email delivery for verification codes and security notices |
| `SIGNUP_BONUS_CREDITS` | no | Free credits for new accounts (default 25) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | no | Enables credit purchases |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | recommended in production | Cloudflare Turnstile bot check on signup, login and password reset (set both or neither) |
| `CSP_REPORT_URI`, `CSP_REPORT_ONLY` | no | Where to send Content-Security-Policy violation reports; `true` to report without blocking |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Enables “Continue with Google” |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | no | Contact address shown in the footer and legal pages (inlined at build time) |

### 3. Prepare the database

```bash
npm run db:seed
```

This builds all indexes (unique emails, idempotency keys, TTL clean-up) and inserts the default credit packages. Packages are
also inserted automatically on first use if the collection is empty. To change prices, edit the `creditpackages` collection
(or `DEFAULT_PACKAGES` in `lib/packages.ts` and run `npm run db:seed -- --update`). Prices are stored in minor units (paise/cents).

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000, create an account, and you're in.

**Email in development:** if `SMTP_HOST` is not set and `NODE_ENV` is not `production`, verification codes are printed to the
dev-server console instead of being emailed, so you can sign up without an SMTP provider. In production, missing SMTP
configuration is reported as an error — codes are never logged.

**Email in production:** on port 587 the app requires STARTTLS (it will not fall back to plaintext); on port 465 it uses
implicit TLS. Certificates must be valid. Send from a domain you have verified with your provider and publish SPF, DKIM and
DMARC records, otherwise verification codes may land in spam.

## How it works

### Authentication

```
Signup:  form ─► POST /api/auth/signup ─► code emailed ─► enter code ─► account created + signup credits ─► signed in
Login:   email+password ─► POST /api/auth/login ─► code emailed ─► enter code ─► signed in
Reset:   email ─► POST /api/auth/password/forgot ─► code emailed ─► code + new password ─► all sessions revoked
```

- A correct password **never** creates a session by itself. Sessions are only issued by NextAuth's `otp` credentials provider,
  which requires a valid code for a challenge created by the signup or login endpoint.
- Codes are 6 digits from a CSPRNG, stored as an HMAC (keyed by `NEXTAUTH_SECRET`) bound to their challenge, expire after
  10 minutes, are single-use, allow 5 attempts, and can be resent after a 60-second cooldown (max 5 sends). Failed guesses are
  also capped per email and purpose across challenges, and all auth endpoints are rate-limited per IP and per email.
- **Email abuse protection:** each address can receive only a limited number of codes per purpose (signup, reset and email
  change: 6/hour and 12/day; sign-in: 10/hour and 30/day), however many IPs the requests come from. Emails to addresses
  nobody has verified yet contain no user-typed text. With `TURNSTILE_*` set, signup, login and forgot-password also
  require a Cloudflare Turnstile token, verified server-side (fails closed).
- Sessions are encrypted JWT cookies (HttpOnly, SameSite=Lax, Secure over HTTPS) that carry a session version. Every API call
  and workspace page load re-checks the user and version in MongoDB, so password changes, password resets, “sign out
  everywhere” and account deletion revoke existing sessions immediately.
- Forgot-password responses are identical whether or not the email has an account.
- Google sign-in (optional) links to an existing account only when Google reports the email as verified.

### Security headers and Content-Security-Policy

`middleware.ts` gives every page a fresh nonce and a strict CSP (`lib/security/csp.ts`). Scripts run only with the nonce
(`'strict-dynamic'`, no `unsafe-inline`/`unsafe-eval` in production), frames are limited to Razorpay Checkout and Turnstile,
and plugins, `<base>` hijacking and framing are blocked. Pages are rendered per request so each carries its nonce. Zod is
imported through `lib/zod.ts`, which turns off its eval-based JIT (ESLint enforces this). `next.config.ts` adds HSTS,
`X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`.

### Credits

| Action | Credits |
| --- | --- |
| Short-form & lists (captions, titles, taglines, bios) | 1 |
| Medium-form (emails, ads, product descriptions) | 2 |
| Long-form (blog posts, articles, scripts) | 3 (4 at “Long” length) |
| Editor AI action (improve, shorten, tone…) | 1 |
| Alternative versions | 2 |

Credits are only ever changed on the server through `lib/credits.ts`:

1. A generation request carries a client-generated `requestId`; a pending record is created first (unique per user and
   request), so retries and double-clicks are charged once.
2. Credits are deducted with a conditional update (`availableCredits >= cost`), so concurrent requests can never overdraw.
3. Every change is written to the `credittransactions` ledger with a unique idempotency key (in a MongoDB transaction when the
   deployment supports it; standalone servers fall back to compensating writes).
4. If the AI call fails, the credits are refunded automatically; operations interrupted by a crash are refunded on the user's
   next request.

### Payments (Razorpay)

1. `POST /api/orders` creates an order for a database-defined package (the client never sends a price).
2. The browser opens Razorpay Checkout. On success, `POST /api/orders/:id/verify` checks the payment signature **and**
   re-fetches the payment from Razorpay; credits are granted only for a captured payment with the expected amount and currency.
3. The webhook `POST /api/webhooks/razorpay` (events `payment.captured`, `order.paid`, `payment.failed`, `refund.created`,
   `refund.processed`, `refund.failed`) verifies the `X-Razorpay-Signature` HMAC of the raw body. Fulfilment is idempotent,
   so the webhook and the verify call can both arrive safely.
4. **Refunds** are issued from the Razorpay Dashboard and reconciled from the refund webhooks (`lib/refunds.ts`). The order
   records the refund, and the matching share of the package's credits is taken back. Shares are exact across partial
   refunds, and the balance never goes below zero (credits already spent are logged as a shortfall). A fully refunded order
   becomes *Refunded*; a failed refund restores the credits.

**Capture mode:** Razorpay's Orders API has no per-order capture flag — capture follows your Dashboard setting. Use
**automatic capture** so credits arrive right after checkout. With manual capture, the checkout tells the user the payment
is pending and credits are granted by the `payment.captured` webhook once you capture it. Payments you never capture are
auto-refunded by Razorpay, and those refunds are recorded without granting credits.

Without Razorpay keys, the billing page shows packages with purchases disabled. To test payments, use Razorpay **test mode**
keys (`rzp_test_…`) and test cards; to add credits manually (support, QA), use the CLI:

```bash
npm run credits:grant -- user@example.com 100 "Support goodwill"
```

### AI provider

`lib/ai/index.ts` returns an implementation of the `AIProvider` interface (`lib/ai/types.ts`). The OpenAI implementation uses
the Chat Completions API with timeouts, one retry for transient failures, adaptation for models that reject optional
parameters (e.g. reasoning models and `temperature`), and maps provider errors to safe messages. To add another provider,
implement `AIProvider` and select it with `AI_PROVIDER`. Prompts are built in `lib/ai/prompts.ts` from a shared system prompt,
the template's own instructions (`lib/ai/template-instructions.ts`), and the user's settings; user input is fenced as data.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Unit tests; integration tests too when `TEST_MONGODB_URI` is set |
| `npm run test:e2e` | End-to-end tests over HTTP (see below) |
| `npm run db:seed` | Create indexes and default credit packages |
| `npm run credits:grant -- <email> <amount> [reason]` | Admin credit adjustment |
| `npm run email:test -- <email>` | Send a test email through the configured SMTP server (production TLS rules) |

## Testing

```bash
# Unit tests (no services needed)
npm test

# + integration tests against a disposable database (its name must contain "test")
TEST_MONGODB_URI="mongodb://127.0.0.1:27017/scriptly_test" npm test

# End-to-end: builds the app if needed, starts a mock OpenAI server and an SMTP sink, runs the production
# server against a disposable database (its name must contain "e2e"; it is dropped first) and exercises
# the real HTTP API: signup/login with emailed codes, generation, credits, documents, ownership, payments…
E2E_MONGODB_URI="mongodb://127.0.0.1:27017/scriptly_e2e" npm run test:e2e
```

The mock servers in `tests/mocks/` exist only for tests; the application never uses them unless pointed at them.
Credit-transaction tests run against both replica-set (transactions) and standalone MongoDB.

## Deployment

Scriptly.ai is **not production-ready until the live integration tests pass**. Use these guides in order:

1. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production configuration for every variable, MongoDB, OpenAI, SMTP, Razorpay
   (capture setting, webhook events), Cloudflare Turnstile, Google sign-in and hosting (Vercel or your own Node server).
2. [docs/INTEGRATION_TESTING.md](docs/INTEGRATION_TESTING.md): exact live tests for OpenAI, your SMTP provider, Razorpay
   test mode (checkout, automatic capture, success, failure, refunds) and the bot check, CSP and headers.
3. [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md): what blocks launch vs what can wait, the checklist, a launch-day
   runbook with kill switches, and the sign-off table.

The essentials: run `npm run db:seed` against the production database before taking traffic (the unique indexes make
payments idempotent); set `NEXTAUTH_URL` to your HTTPS origin; put the app behind a platform or proxy that sets
`x-forwarded-for`/`x-real-ip` (IP rate limits rely on them); and allow 120 s for `/api/generate` and `/api/refine`.

## Further reading

- [docs/API.md](docs/API.md) — every endpoint, its auth and payloads
- [docs/DATABASE.md](docs/DATABASE.md) — collections, fields, indexes and invariants
- [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) — what is verified, what isn't built, known limitations and risks
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) — what was built and verification results

## Contributing

1. Fork the repository and create a branch: `git checkout -b feature/your-feature`
2. Make your change with tests; run `npm run lint && npm run typecheck && npm test`
3. Open a pull request
