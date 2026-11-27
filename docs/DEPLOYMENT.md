# Deploying Scriptly.ai to production

This guide covers the production configuration of every external service Scriptly.ai uses, and how to host it.
Before you take real payments, run the live checks in **[INTEGRATION_TESTING.md](INTEGRATION_TESTING.md)**, then work
through **[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)**.

> Never commit real values. Put them in your host's environment settings (or an untracked `.env.production.local` on a
> server you control). `.env.example` lists every variable with placeholders only.

## What you need

| Service | Purpose | Required? |
| --- | --- | --- |
| Node.js host (Node **20.9+**, 22 LTS recommended) or Vercel **Pro** | Runs the app | Yes |
| MongoDB (Atlas recommended) | All data | Yes |
| OpenAI API (or an OpenAI-compatible endpoint) | Content generation | Yes (generation is disabled without it) |
| SMTP provider + a domain you control | Verification and sign-in codes | Yes in production (signup and login are impossible without email) |
| Razorpay | Credit purchases | Only if you sell credits (purchases are disabled without it) |
| Cloudflare Turnstile | Bot check on signup, login and password reset | Strongly recommended for a public launch |
| Google OAuth client | "Continue with Google" | Optional |

## 1. Environment variables

Everything is read **at runtime** except `NEXT_PUBLIC_SUPPORT_EMAIL`, which Next.js inlines **at build time**. Set it
before `npm run build`, or rebuild after changing it.

### Core

| Variable | Required | Value |
| --- | --- | --- |
| `NEXTAUTH_URL` | Yes | Public HTTPS origin, e.g. `https://scriptly.example.com` (no trailing slash). Also turns on `upgrade-insecure-requests` in the CSP. |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32`. Encrypts sessions and keys the OTP hashes. **Rotating it signs everyone out and invalidates codes in flight.** (`AUTH_SECRET` is accepted as an alias.) |
| `MONGODB_URI` | Yes | `mongodb+srv://<user>:<password>@<cluster>/scriptly?retryWrites=true&w=majority` (`MONGODB_URL` is accepted as an alias). |
| `APP_URL` | No | Public URL for metadata, if different from `NEXTAUTH_URL`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Recommended | Shown in the footer and legal pages. **Build-time.** |
| `SIGNUP_BONUS_CREDITS` | No | Free credits for new accounts (default `25`). |
| `SESSION_MAX_AGE_DAYS` | No | Session lifetime, 1–90 (default `7`). Every request re-checks the account in MongoDB, so revocation is immediate regardless. |
| `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_SENDS` | No | Code lifetime (10), attempts per code (5), resend cooldown (60 s), sends per code session (5). |

### OpenAI

| Variable | Required | Value |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | A **project** API key. |
| `OPENAI_MODEL` | No | Default `gpt-6-luna` (OpenAI's listed replacement for `gpt-4o-mini`, which shuts down on 2027-01-14). |
| `OPENAI_REASONING_EFFORT` | No | Default `none`. `low`/`medium`/`high` for more deliberate output, or `auto` to omit the parameter. Models that reject it are retried without it. |
| `OPENAI_TIMEOUT_MS` | No | Default `90000`. Keep it below the routes' 120 s `maxDuration`. |
| `OPENAI_BASE_URL` | No | Only for an OpenAI-compatible gateway or proxy. |

### Email (SMTP)

| Variable | Required | Value |
| --- | --- | --- |
| `SMTP_HOST` | Yes | Your provider's SMTP host. |
| `SMTP_PORT` | Yes | `587` (STARTTLS) or `465` (implicit TLS). |
| `SMTP_SECURE` | No | Defaults to `true` only for port 465. |
| `SMTP_REQUIRE_TLS` | No | Default **`true` in production**: refuses to send unless STARTTLS succeeds. Leave it on. |
| `SMTP_USER`, `SMTP_PASS` | Usually | Credentials from your provider. |
| `SMTP_FROM` | Yes | e.g. `Scriptly.ai <no-reply@mail.example.com>`. Must be an address on the domain you verified with the provider. |

### Payments (Razorpay)

| Variable | Required | Value |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | For payments | `rzp_test_…` in test mode, `rzp_live_…` in production. |
| `RAZORPAY_KEY_SECRET` | For payments | The key's secret (shown once when generated). |
| `RAZORPAY_WEBHOOK_SECRET` | For payments | The secret you type when creating the webhook (`openssl rand -hex 32`). Not the key secret. |

### Bot check (Cloudflare Turnstile)

| Variable | Required | Value |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | Recommended | Widget site key. |
| `TURNSTILE_SECRET_KEY` | Recommended | Widget secret key. |

Set **both or neither**. With only one, signup/login/reset return `503 BOT_CHECK_MISCONFIGURED` rather than run
half-protected. **Never use Cloudflare's test keys in production**: the test secrets accept a dummy token anyone can send.

### Content-Security-Policy

| Variable | Required | Value |
| --- | --- | --- |
| `CSP_REPORT_URI` | No | HTTPS endpoint that receives violation reports (any CSP report collector). |
| `CSP_REPORT_ONLY` | No | `true` sends the policy as `Content-Security-Policy-Report-Only` (reports, doesn't block). Use it only for a cautious first rollout; the default is enforcing. |

### Google sign-in (optional)

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth web client. The button only appears when both are set. |

## 2. MongoDB

1. **Create a cluster.** Atlas clusters are replica sets, so credit operations run in transactions. Choose a dedicated
   tier for production so you get backups, in a region close to your app servers.
2. **Create a database user** with `readWrite` on the `scriptly` database only (Atlas → Database Access → custom
   privileges), and a long random password.
3. **Network access.** Allow only your servers' egress IPs. Serverless hosts with changing IPs need either a static-egress
   option or a wider allow-list. If you must allow `0.0.0.0/0`, the strong credentials and TLS are what protect you.
4. **Connection string** → `MONGODB_URI`. Include the database name (`/scriptly`).
5. **Create indexes and default packages** (once now, and again after every release that adds indexes; this one adds
   `orders.providerPaymentId`):

   ```bash
   MONGODB_URI='<production uri>' npm run db:seed
   ```

   The unique indexes are part of correctness: they make payments, refunds and AI charges idempotent. Don't take traffic
   until this has run against the production database.
6. **Backups.** Turn on continuous backups or scheduled snapshots and do one test restore before launch.

Default package prices are in `lib/packages.ts` (INR). To change prices later, edit the `creditpackages` documents, or
edit the file and run `npm run db:seed -- --update`.

## 3. OpenAI

1. In the OpenAI platform, create a **project** for Scriptly.ai and a project API key → `OPENAI_API_KEY`.
2. Set a **monthly budget and usage alerts** for the project. Generation is credit-gated per user, but the budget is your
   hard ceiling against abuse or bugs.
3. Confirm the project has access to the model you configure (`gpt-6-luna` by default). Then run the live checks in
   [INTEGRATION_TESTING.md §1](INTEGRATION_TESTING.md#1-openai-generation-with-a-real-api-key).
4. Check your unit economics: each template's credit cost (`lib/templates/registry.ts`) and package prices should cover the
   token cost of a *long* generation, not an average one.

## 4. Email (SMTP)

1. Use a **transactional** email provider (a personal mailbox has low sending limits and poor deliverability).
2. **Verify a sending domain** with the provider and publish the DNS records it gives you: **SPF**, **DKIM** and a
   **DMARC** policy. A subdomain such as `mail.example.com` keeps it separate from your main mail.
3. Create SMTP credentials → `SMTP_USER`/`SMTP_PASS`, and set `SMTP_FROM` to an address on the verified domain.
4. Prefer port 587 with STARTTLS (`SMTP_SECURE` unset). In production the app refuses to send unless the TLS upgrade
   succeeds and the server certificate is valid.

Typical settings (confirm in your provider's dashboard; providers change these):

| Provider | Host | Port | Username | Password |
| --- | --- | --- | --- | --- |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587 | SES SMTP username | SES SMTP password (not your AWS keys). New accounts start in the **sandbox** and can only email verified addresses until you request production access. |
| SendGrid | `smtp.sendgrid.net` | 587 | `apikey` | An API key |
| Postmark | `smtp.postmarkapp.com` | 587 | Server API token | Server API token |
| Google Workspace | `smtp.gmail.com` | 587 | Your address | An app password (needs 2-Step Verification). Daily sending limits apply. |

Codes are time-sensitive (10 minutes), so check delivery latency during the live test, not just arrival.

## 5. Razorpay

1. **Activate your account** (KYC and website details). Razorpay's documentation currently disagrees on which website
   policy pages are mandatory at onboarding. Check the requirements shown in your Dashboard, and see the launch checklist
   for the pages Scriptly.ai doesn't include yet.
2. **API keys:** generate test keys first (`rzp_test_…`), and live keys after activation. The secret is shown once.
3. **Payment capture:** Dashboard → Account & Settings → *Capture and refund settings* → keep **automatic capture**
   (the default). Scriptly.ai only credits **captured** payments:
   - With automatic capture, credits arrive within seconds of payment.
   - With manual capture, credits arrive only when you capture. Payments you don't capture within the timeout
     (3 days by default) are auto-refunded by Razorpay. Scriptly.ai records those refunds and grants nothing.
4. **Webhook** (one in test mode, one in live mode — they're separate): Dashboard → Account & Settings → Webhooks → Add:
   - URL: `https://<your-domain>/api/webhooks/razorpay`. It must be public on port 80/443; Razorpay won't deliver to localhost.
   - Secret: a random value → `RAZORPAY_WEBHOOK_SECRET`.
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.
5. **Refunds** are issued from the Razorpay Dashboard. Scriptly.ai reconciles them from the refund webhooks: it records
   the refund on the order and takes back the matching share of the credits, without going below zero (credits already
   used are logged as a shortfall). A full refund marks the order *Refunded*. If a refund fails, the credits are restored.

## 6. Cloudflare Turnstile

1. Cloudflare dashboard → **Turnstile** → *Add widget*. Add your production hostname (and a staging hostname if you have
   one) and choose **Managed** mode.
2. Copy the site key → `TURNSTILE_SITE_KEY` and the secret key → `TURNSTILE_SECRET_KEY`. No rebuild is needed.
3. The server calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`, so outbound HTTPS must be allowed. If
   Cloudflare can't be reached, the forms **fail closed** (`503 BOT_CHECK_UNAVAILABLE`).
4. The bot check protects signup, login (password step) and forgot-password. Per-recipient email quotas and rate limits
   apply whether or not Turnstile is on.

## 7. Google sign-in (optional)

Google Cloud Console → *APIs & Services* → configure the OAuth consent screen → create an **OAuth client ID** (Web
application):

- Authorized JavaScript origin: `https://<your-domain>`
- Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Only Google accounts with a verified email are accepted.

## 8. Hosting

All application state lives in MongoDB, so you can run several instances behind a load balancer. Every page is rendered
per request so it can carry its CSP nonce (there are no statically cached pages).

### Option A — Vercel

- Use a **Pro** team: the Hobby plan is for non-commercial use.
- Add the environment variables for **Production**. For **Preview** deployments, use test keys (Razorpay test mode,
  a separate MongoDB database, Turnstile on a staging hostname).
- `/api/generate` and `/api/refine` declare `maxDuration = 120`. That's within Vercel's limits with Fluid compute
  (300 s default on every plan).
- Vercel sets `x-forwarded-for` / `x-real-ip`, which the IP rate limits rely on.

### Option B — your own Node server (VM, Docker, Render, Railway, Fly…)

```bash
npm ci
npm run build        # needs NEXT_PUBLIC_SUPPORT_EMAIL set
npm run start        # next start, default port 3000 (use -p to change)
```

- Put it behind a reverse proxy that terminates TLS and **overwrites** `X-Forwarded-For`/`X-Real-IP` with the real client
  address. Never pass through client-supplied values, or the IP rate limits can be bypassed.
- Allow at least 120 s of proxy read timeout for `/api/generate` and `/api/refine`.
- Run under a supervisor (systemd, Docker restart policy, pm2) and send stdout/stderr to your log store.

### After deploying

1. `curl -sI https://<your-domain>/login` should show `content-security-policy` (with a `nonce-`),
   `strict-transport-security`, `x-frame-options: DENY` and `x-content-type-options: nosniff`.
2. Run the live checks in [INTEGRATION_TESTING.md](INTEGRATION_TESTING.md) against this deployment.
3. Watch the logs for `[webhook:razorpay]`, `[refunds]`, `[turnstile]`, `[auth]` and `[ai:` lines during the first days.

## 9. Operations

- **Support credit adjustments:** `npm run credits:grant -- user@example.com 100 "Support goodwill"` (run with
  `MONGODB_URI` pointing at production; every change is ledgered). There is no admin UI.
- **Refund shortfalls:** a `[refunds] credits already spent` warning means the customer had used some of the refunded
  credits. Decide case by case; the order's `refunds[].creditsTarget` vs `creditsReversed` shows the difference.
- **Secret rotation:** rotating `NEXTAUTH_SECRET` signs everyone out. Razorpay keeps retrying old events with the old
  webhook secret, so rotate that during a quiet period.
- **Dependencies:** run `npm audit` regularly. The project is on Next.js 15; plan the Next.js 16 upgrade.
