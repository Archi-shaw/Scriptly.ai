# Scriptly.ai — Implementation Status

_Last updated: 2026-11-27_

> For launch decisions see **[PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)** (verification evidence, what isn't
> built, risks) and **[docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)** (what blocks launch, sign-off).

## Summary

Scriptly.ai is code-complete for V1: verified email signup, two-step login with a bot check, a workspace with 83
templates, AI generation and editing, documents, history, server-side credits with a ledger, Razorpay billing with
refund reconciliation, account management, a nonce-based Content-Security-Policy, and a refreshed landing page. All
automated checks pass (see **Verification**).

It is **not yet production-ready**: OpenAI, your SMTP provider, Razorpay and Turnstile still need the live tests in
[docs/INTEGRATION_TESTING.md](docs/INTEGRATION_TESTING.md), and a few business items (refund policy, legal review,
tax) are open. See *Pending integrations*.

## Definition of done

| Item | Status | How it was verified |
| --- | --- | --- |
| Landing page works (all sections, CTAs, live pricing) | ✅ | Browser + E2E (`/` renders, `/api/packages` drives pricing) |
| Responsive navigation (desktop + mobile menu) | ✅ | Browser at 375 px: hamburger menu, no horizontal overflow on 9 pages |
| Signup | ✅ | Browser + E2E |
| Email verification (account created only after the code) | ✅ | E2E asserts no user exists before verification; browser via dev console email |
| Login with password | ✅ | Browser + E2E |
| Login email OTP (password alone never creates a session) | ✅ | Browser (`/api/me` = 401 after password step) + E2E |
| Protected sessions (middleware + DB-checked layout/API) | ✅ | E2E: 6 pages redirect, 5 APIs return 401 signed out; revoked sessions rejected |
| Logout | ✅ | Browser |
| Password reset (enumeration-safe) | ✅ | E2E (identical responses, no email for unknown addresses, decoy codes fail) |
| MongoDB persistence | ✅ | Integration + E2E against real MongoDB (replica set and standalone) |
| Template library (83 templates, search, filter, details) | ✅ | Unit (registry integrity) + browser + E2E |
| Template-specific AI generation | ✅ | Unit (prompt content per template) + E2E/browser (prompt sent to the model) |
| Multiple tones · language selection · AIDA/PAS/BAB | ✅ | Unit + E2E + browser (Spanish + PAS prompt verified) |
| Dashboard uses real user data | ✅ | E2E + browser |
| Content saved / edited / renamed / deleted / duplicated | ✅ | E2E + browser (incl. autosave and edit-conflict detection) |
| Generation history (paginated, reopen, regenerate) | ✅ | E2E + browser |
| Regeneration and AI refinement actions | ✅ | E2E (`/api/refine` actions, variants) |
| Copy and export (md, txt, html, doc, pdf) | ✅ | Implemented client-side; text conversion unit-tested |
| Credit balance, secure deductions, transaction history | ✅ | Integration (25 concurrent charges never overdraw) + E2E (parallel requests) |
| Package data and pricing consistent | ✅ | Landing and billing both read `/api/packages` (DB) |
| Payment integration secure | ✅ | Webhook signature + amount checks, idempotent fulfilment (E2E + integration) |
| Refund reconciliation | ✅ | Refund webhooks reverse credits exactly once, never below zero; failed refunds restore (integration + E2E) |
| Content-Security-Policy | ✅ | Per-request nonces on every page; 0 violations in Chrome incl. Razorpay Checkout and Turnstile (E2E + browser) |
| OTP abuse protection | ✅ | Per-recipient email quotas, per-purpose failure caps, optional Turnstile (integration + unit + browser) |
| Profile management (name, verified email change, password, sign-out-everywhere, deletion) | ✅ | E2E + browser |
| Mobile responsiveness | ✅ | Browser at 375 px |
| Protected API routes secure (ownership/IDOR, CSRF origin, mass assignment) | ✅ | E2E |
| TypeScript checks | ✅ | `npm run typecheck` |
| Lint checks | ✅ | `npm run lint` |
| Production build | ✅ | `npm run build` |
| Documentation | ✅ | README, `.env.example`, `docs/API.md`, `docs/DATABASE.md` |

## Verification (latest run)

- `npm run typecheck` — passes · `npm run lint` — 0 errors, 0 warnings · `npm run build` — passes · `npm audit` — 0 vulnerabilities
- `npm test` with `TEST_MONGODB_URI` — **111/111** unit + integration tests pass
- `npm run test:e2e` — **32/32** end-to-end tests pass against the production build (real HTTP, real MongoDB, real SMTP
  delivery to a local sink, mock OpenAI-compatible server), including CSP nonces on every page and refund webhooks
- Headless Chrome on the production build: 0 CSP violations; Turnstile (Cloudflare test keys) and Razorpay Checkout load
- Browser walkthrough (dev mode, no SMTP → codes printed to the console): signup → OTP → dashboard → generate
  (Spanish + PAS) → edit → rename → save → autosave → search → reopen → history → billing → settings → logout →
  login with OTP; mobile layout check on 9 pages.

Bugs found by testing and fixed: Markdown-to-text conversion swallowed blank lines; the DB connection cache didn't
reconnect after an explicit disconnect; the E2E runner left the Next.js server orphaned; refine prompts were
misclassified by the test mock.

## Architecture decisions

- **One session system:** NextAuth JWT sessions. Password accounts can only get a session through the `otp`
  credentials provider after a verified, single-use code. The NextAuth MongoDB adapter was removed because it wrote
  `users` documents in a different shape from the Mongoose `User` model.
- **Credits:** conditional atomic updates + unique idempotency keys + transactions when available; refunds on failure
  and recovery of interrupted operations.
- **Payments:** Razorpay (the original schema's fields and INR pricing), behind a `PaymentProvider` interface.
- **AI:** OpenAI Chat Completions behind an `AIProvider` interface; template instructions stay server-side.

## Changes to existing code worth knowing

- Landing components moved from `app/components/Landing/*/page.tsx` (which Next.js served as public routes) to
  `app/components/Landing/*.tsx`; copy referencing another product ("Copymatic") and non-existent features was replaced.
- Old prototype routes redirect: `/alltools` → `/templates`, `/mycontent` → `/documents`, `/aiarticlewriter` →
  `/write?template=article-generator`, `/activate` → `/dashboard`.
- Removed: unused shadcn/ui components whose dependencies were never installed (re-add with `npx shadcn@latest add <name>`),
  `lib/mongodb.ts` (adapter client with TLS verification disabled), `HomeLayout.js`, the static tools list (merged into the
  template registry), the superseded `AuthProvider`, and the outdated `documentation` notes.

## Pending integrations (need credentials and live tests, not code)

Configuration: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · procedures: [docs/INTEGRATION_TESTING.md](docs/INTEGRATION_TESTING.md).

1. **OpenAI** — `OPENAI_API_KEY` (default model `gpt-6-luna`; `gpt-4o-mini` shuts down 2027-01-14). Without it, generation is disabled with a clear message.
2. **SMTP** — required in production for verification codes (`SMTP_*`); check with `npm run email:test`.
3. **Razorpay** — keys, webhook secret, and a webhook with the six payment/refund events. Run the test-mode suite, then one live purchase and refund.
4. **Cloudflare Turnstile** — `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (recommended for a public launch).
5. **Google sign-in (optional)** — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; not exercised live.
6. **Business/legal** — review `/terms` and `/privacy`, publish a refund/cancellation policy and contact details, confirm tax invoicing.

## Known limitations / next steps

- Visual checks of dropdown popovers in the in-app browser were limited because the browser pane was hidden (hidden panes
  don't run animation frames). Their behavior is covered by the underlying Radix components and API-level tests.
- No streaming of AI output yet (results appear when complete, with a progress state).
- Admin UI for packages/users does not exist; use the database or `npm run credits:grant`. Refunds are issued in the
  Razorpay Dashboard and reconciled automatically.
- Full list of what isn't built: [PRODUCTION_READINESS.md §3](PRODUCTION_READINESS.md#3-not-implemented).
- Dependency security: `npm audit` reports **0 vulnerabilities** (in-range fixes plus `overrides` for packages pinned by
  Next 15 and Typography; compiled CSS verified identical). Future Next 15 advisories may require the Next 16 upgrade.
