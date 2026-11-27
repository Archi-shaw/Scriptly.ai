# Scriptly.ai — V1 launch checklist

**Status: code-complete for V1, not yet production-ready.** The external integrations (OpenAI, your SMTP provider,
Razorpay, Cloudflare Turnstile) have only been exercised against local stand-ins and Cloudflare's test keys. Production
readiness can be claimed once every row in [§5](#5-live-integration-sign-off) is signed off.

Related: [DEPLOYMENT.md](DEPLOYMENT.md) (configuration) · [INTEGRATION_TESTING.md](INTEGRATION_TESTING.md) (live test
procedures) · [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md) (what's verified, what isn't built, known risks).

## 1. Necessary before a public launch

Every item here blocks launch. None needs new application code; they are configuration, verification or business
decisions.

| # | Item | Why it blocks | How |
| --- | --- | --- | --- |
| 1 | Live OpenAI test passes | Generation is the product; the default model has never run against your key | [Testing §1](INTEGRATION_TESTING.md#1-openai-generation-with-a-real-api-key) |
| 2 | Live SMTP test passes with inbox placement | No email means no signup or login (2FA is mandatory) | [Testing §2](INTEGRATION_TESTING.md#2-smtp-delivery-with-your-email-provider) |
| 3 | Razorpay test-mode suite + one live purchase and refund | Money must not be lost or double-credited | [Testing §3](INTEGRATION_TESTING.md#3-razorpay-test-mode-checkout-capture-success-failure-refunds) |
| 4 | Turnstile enabled with real keys | Without it, rotating IPs can push code emails to many addresses and hurt your sender reputation (per-address quotas cap each inbox, not the total) | [Deployment §6](DEPLOYMENT.md#6-cloudflare-turnstile), [Testing §4](INTEGRATION_TESTING.md#4-bot-check-csp-and-security-headers-on-the-deployed-site) |
| 5 | Production MongoDB with backups, indexes and a tested restore | Unique indexes make payments idempotent; there's no data without backups | [Deployment §2](DEPLOYMENT.md#2-mongodb) |
| 6 | Proxy sets client IP headers correctly | IP rate limits trust `x-forwarded-for` / `x-real-ip` | [Deployment §8](DEPLOYMENT.md#8-hosting) |
| 7 | OpenAI project budget and alerts | A hard ceiling on spend from abuse or bugs | [Deployment §3](DEPLOYMENT.md#3-openai) |
| 8 | Terms and Privacy reviewed for your business and jurisdiction | They're sensible defaults, not legal advice | `/terms`, `/privacy` (`app/terms`, `app/privacy`) |
| 9 | **Refund and cancellation policy** published, plus a contact page or contact details | Customers need to know when they can get money back; Razorpay may ask for these pages (its docs disagree; check your Dashboard). The app handles refunds, but **the policy is your decision**, so it isn't written for you | Add pages like `app/terms` (they use `LegalPage`), link them in `app/components/Landing/Footer.tsx` |
| 10 | Tax and invoicing obligations confirmed (e.g. GST) | May be required before you charge customers | Your accountant; Razorpay can email payment receipts but not tax invoices |
| 11 | A monitored support inbox | Users locked out by 2FA or quotas need a human | Set `NEXT_PUBLIC_SUPPORT_EMAIL` before building |
| 12 | Basic monitoring: uptime check + searchable logs + alert on 5xx spikes | Otherwise you learn about outages from users | Your host's monitoring or any uptime service |

## 2. Can be deferred

| Feature | Status today | Suggested timing |
| --- | --- | --- |
| Error tracking (Sentry or similar) | Logs to stdout only | First weeks (cheap, high value) |
| Admin console (users, orders, packages) | CLI: `npm run credits:grant`, `npm run db:seed -- --update`; refunds via the Razorpay Dashboard (auto-reconciled) | When support volume grows |
| Re-authentication for Google-only accounts before email change or deletion | Needs an active session only | V1.1 |
| Personal data export ("download my data") | Not built; documents can be exported one at a time | Before targeting jurisdictions that require it |
| Streaming AI output | Results appear when complete, with a progress state | V1.x (UX) |
| Subscriptions | Pay-as-you-go credits only | When pricing strategy calls for it |
| Teams, document version history, plagiarism checks | Not built | Later |
| Native `.docx` export | Word-compatible `.doc` (HTML) | Later |
| Disposable-email blocking | Not built (quotas + Turnstile + rate limits apply) | If abuse appears |
| Next.js 16 upgrade | Next 15.5.29 with 0 known advisories | Schedule within a few months |

## 3. Pre-launch checklist

### A. Accounts and business

- [ ] Domain registered; DNS hosting you control
- [ ] Razorpay account activated for live payments (KYC + website details)
- [ ] Refund/cancellation policy decided and published; contact details published
- [ ] Terms and Privacy reviewed; tax/invoicing position confirmed
- [ ] Transactional email provider account; sending domain verified (SPF, DKIM, DMARC)
- [ ] OpenAI project with billing, budget and alerts
- [ ] Cloudflare account with a Turnstile widget for your hostnames
- [ ] Support mailbox monitored

### B. Infrastructure

- [ ] MongoDB production cluster (replica set), least-privilege user, network allow-list
- [ ] Backups enabled and **one restore tested**
- [ ] `npm run db:seed` run against production (indexes + default packages); prices checked in `creditpackages`
- [ ] Hosting: Vercel Pro, or a Node 20.9+ server behind a TLS proxy with a 120 s timeout for AI routes
- [ ] All variables from [DEPLOYMENT.md §1](DEPLOYMENT.md#1-environment-variables) set for production; test keys only in staging
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` set **before** the production build
- [ ] Staging environment with its own database, Razorpay test keys and a test-mode webhook

### C. Security configuration

- [ ] `NEXTAUTH_SECRET` freshly generated for production (not reused from staging)
- [ ] `NEXTAUTH_URL` is the HTTPS production origin
- [ ] `SMTP_REQUIRE_TLS` unset or `true`
- [ ] Turnstile **real** keys set (both); test keys nowhere in production
- [ ] Razorpay **live** webhook with its own secret; events: `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`
- [ ] Automatic capture enabled in Razorpay
- [ ] Reverse proxy overwrites `X-Forwarded-For` / `X-Real-IP` (or you use Vercel)
- [ ] `curl -sI https://<domain>/login` shows the CSP with a nonce, HSTS, `X-Frame-Options: DENY`, `nosniff`
- [ ] `.env*` files with real values exist only on servers or in the host's settings, never in git

### D. Verification

- [ ] [Testing §1–§4](INTEGRATION_TESTING.md) pass on staging; results recorded in §5 below
- [ ] One live-mode purchase and full refund pass on production ([Testing §3.5](INTEGRATION_TESTING.md#35-go-live-check-live-mode-after-activation))

## 4. Launch-day runbook

1. Freeze changes; tag the release commit.
2. Deploy to production with live configuration. Run `npm run db:seed` if the release adds indexes.
3. Smoke test on production: signup → code email → dashboard → one generation → Billing loads → logout → login with code.
4. Live purchase + refund ([Testing §3.5](INTEGRATION_TESTING.md#35-go-live-check-live-mode-after-activation)).
5. Turn on uptime monitoring and log alerts; watch the logs for the first hours.
6. Open signups (announce).

**Rollback and kill switches** (environment changes take effect on restart or redeploy; no rebuild needed):

| Problem | Action |
| --- | --- |
| Bad release | Redeploy the previous release (the database schema changes are additive) |
| The CSP blocks something in production | Set `CSP_REPORT_ONLY=true` temporarily, fix, then remove it |
| Cloudflare outage blocks signup/login (the bot check fails closed) | Unset **both** `TURNSTILE_*` variables temporarily; quotas and rate limits still apply |
| Payment problems | Unset `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`: purchases are disabled with a clear message; existing credits keep working |
| OpenAI outage or runaway cost | Failed generations refund automatically; lower the OpenAI project budget or unset the key to pause generation |

## 5. Live integration sign-off

| Check | Environment | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| OpenAI: direct API check + templates a–e + failure refund ([§1](INTEGRATION_TESTING.md#1-openai-generation-with-a-real-api-key)) | | | | |
| SMTP: `email:test`, SPF/DKIM/DMARC pass, inbox placement in Gmail and Outlook, all five flows ([§2](INTEGRATION_TESTING.md#2-smtp-delivery-with-your-email-provider)) | | | | |
| Razorpay test mode: success, webhook-only fulfilment, replay, failure, dismiss ([§3.1–3.2](INTEGRATION_TESTING.md#31-successful-payment-with-automatic-capture)) | | | | |
| Razorpay refunds: full, partial ×2, spent credits, replay ([§3.4](INTEGRATION_TESTING.md#34-refund-reconciliation)) | | | | |
| Razorpay live mode: purchase + refund ([§3.5](INTEGRATION_TESTING.md#35-go-live-check-live-mode-after-activation)) | | | | |
| Turnstile real keys, CSP console clean, headers ([§4](INTEGRATION_TESTING.md#4-bot-check-csp-and-security-headers-on-the-deployed-site)) | | | | |
| Google sign-in, if enabled ([§5](INTEGRATION_TESTING.md#5-google-sign-in-only-if-enabled)) | | | | |

## 6. First week after launch

- Daily: 5xx rate, `[webhook:razorpay]` errors, `[refunds]` shortfall warnings, `[turnstile]` errors, `[email] delivery failed`.
- Compare the Razorpay Dashboard (captured payments, refunds) with `orders` in MongoDB: every captured payment should
  have a `paid`/`fulfilled` order, and every refund a `refunds[]` entry.
- OpenAI spend vs credits sold; adjust prices or credit costs if needed.
- Email bounce and complaint rates in your provider's dashboard.
