# Live integration tests

The automated suites run against **local stand-ins**: a mock OpenAI server, a local SMTP sink, and locally signed Razorpay
webhooks. These procedures exercise the **real** services. Scriptly.ai should not be called production-ready until
§1–§4 pass against the environment you're launching.

Record each result (date, environment, pass/fail, notes) in the table in
[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md#5-live-integration-sign-off).

**Database queries:** examples use `mongosh "$MONGODB_URI"` on the database being tested. Never run tests against the
production database before launch, and don't run `npm test` or `npm run test:e2e` against it at all (they delete data).

**Keeping secrets out of shell history:** read keys with `read -rs VAR && export VAR` instead of typing them inline.

---

## 1. OpenAI generation with a real API key

**Environment:** your machine. Nothing else external is needed.

1. Check the key and model directly, before involving the app:

   ```bash
   read -rs OPENAI_API_KEY && export OPENAI_API_KEY
   curl -sS https://api.openai.com/v1/chat/completions \
     -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
     -d '{"model":"gpt-6-luna","reasoning_effort":"none","max_completion_tokens":50,
          "messages":[{"role":"user","content":"Reply with the single word: ready"}]}'
   ```

   **Expected:** JSON with `choices[0].message.content` ≈ `ready`. A `401` means a bad key; a `404`/`model_not_found`
   means the project lacks the model (set `OPENAI_MODEL` to one it has, and repeat). A `400` about `reasoning_effort`
   is handled by the app (it retries without the parameter), but note it.
2. Create `.env.local` (git-ignored) with `MONGODB_URI` (a local or test database), `NEXTAUTH_URL=http://localhost:3000`,
   `NEXTAUTH_SECRET`, `OPENAI_API_KEY` and, if you changed it, `OPENAI_MODEL`. Leave `SMTP_HOST` empty: in development,
   sign-in codes are printed to the server console.
3. `npm run dev`, open http://localhost:3000/signup, create an account (the code appears in the terminal), and note the
   balance on the dashboard (25 credits by default).
4. On **Write**, run these generations, and time each one:

   | # | Template | Settings | Check |
   | --- | --- | --- | --- |
   | a | Blog Post Generator | Length **Long**, English | Complete article with headings, no "hit the length limit" warning, under ~60 s |
   | b | Facebook Ad Copy | Framework **PAS** | The PAS structure is visible; the requested number of variants is present |
   | c | Product Description | Language **Hindi** (or another non-English language), tone Friendly | Entirely in that language |
   | d | Cold Outreach Email | Framework **AIDA**, custom instructions | Instructions followed |
   | e | Any | Then in the editor: **Improve writing**, **Shorten**, **Change tone** | Each action returns edited text |

5. **Expected after each run:** the balance drops by the credit cost shown on the button; the item appears in
   **History**; the server log has no `[ai:openai] request failed` lines. In the database:

   ```js
   db.generatedcontents.find({}, { templateId: 1, status: 1, model: 1, usage: 1, durationMs: 1, creditsUsed: 1 })
     .sort({ createdAt: -1 }).limit(5)
   ```

   Every row should be `status: "completed"` with your model name, token usage, and `durationMs` well under `90000`.
6. **Failure path:** stop the server, set `OPENAI_API_KEY=sk-invalid`, restart, and generate once. **Expected:** a clear
   error message in the UI, and the credits are back (the ledger shows a *Usage* and a matching *Refund* entry).
   Restore the real key.
7. Review the output **quality** for the templates you'll promote, and check the cost per generation in the OpenAI
   usage dashboard against your credit pricing.

**Pass when:** a–e succeed with acceptable quality and latency, and the failure path refunds.

---

## 2. SMTP delivery with your email provider

**Environment:** your machine first, then repeat step 4 on the deployed site.

1. Complete [DEPLOYMENT.md §4](DEPLOYMENT.md#4-email-smtp) (verified domain, SPF/DKIM/DMARC records published).
   DNS can take a while to propagate. Check with:

   ```bash
   dig +short TXT <your-sending-domain>            # SPF: "v=spf1 … include:<provider> …"
   dig +short TXT _dmarc.<your-sending-domain>     # DMARC: "v=DMARC1; p=…"
   ```

2. Put `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` in `.env.local`, then send a test message
   through the app's own mailer. It uses production rules, so TLS is required:

   ```bash
   npm run email:test -- you@your-real-inbox.com
   ```

   **Expected:** `Accepted by the SMTP server in … ms`. Errors and their usual causes:
   - `Error upgrading connection with STARTTLS`: wrong port, or the server doesn't offer TLS. Use 587, or 465 with
     `SMTP_SECURE=true`.
   - `Invalid login` / `535`: wrong credentials, or the provider wants an app password or API key.
   - Certificate errors: `SMTP_HOST` doesn't match the certificate. Use the exact hostname the provider documents.
   - Sender rejected: `SMTP_FROM` isn't on a verified domain.
3. In the received message, open the raw headers (Gmail: ⋮ → *Show original*). **Expected:** `SPF: PASS`,
   `DKIM: PASS`, `DMARC: PASS`, and the message is in the **inbox**, not spam. Fix DNS before continuing if not.
4. Run the real flows. Use `npm run dev` with SMTP set, or better, the deployed staging site, and test with at least
   one Gmail and one Outlook/Microsoft inbox:

   | Flow | Steps | Expected email |
   | --- | --- | --- |
   | Signup | /signup with a new address | "Verify your email for Scriptly.ai", greeting **without** the typed name |
   | Login | /login with the password | "Your Scriptly.ai sign-in code" |
   | Resend | On the code screen, wait 60 s, *Resend* | A new code; the old one stops working |
   | Password reset | /forgot-password | "Reset your Scriptly.ai password", then a "password was changed" notice after resetting |
   | Email change | Settings → change email | Code to the **new** address |

   For each one: it arrives within ~30 s, the code works once, and it is in the inbox.
5. **Abuse limits (staging):** request password-reset codes for one address 7 times within an hour. **Expected:** the
   7th is refused with "Too many codes have been sent to this email address…". The address's sign-in codes still work.

**Pass when:** steps 2–4 succeed with inbox placement for Gmail and Outlook.

---

## 3. Razorpay test mode: checkout, capture, success, failure, refunds

**Environment:** a **public HTTPS staging deployment** (Razorpay doesn't deliver webhooks to localhost and accepts only
ports 80/443), with its own test database, working SMTP, Razorpay **test** keys, and a **test-mode** webhook.

### 3.0 Setup

1. Razorpay Dashboard → switch to **Test Mode**.
2. *Account & Settings → API Keys* → generate a test key → staging `RAZORPAY_KEY_ID` (`rzp_test_…`) and
   `RAZORPAY_KEY_SECRET`.
3. *Account & Settings → Webhooks → Add New Webhook*:
   URL `https://<staging-domain>/api/webhooks/razorpay`, a new random secret (→ staging `RAZORPAY_WEBHOOK_SECRET`), and
   events `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.
   (In test mode the Dashboard may ask for an OTP when you save; Razorpay documents a fixed test-mode OTP for this.)
4. *Account & Settings → Capture and refund settings* → confirm **Automatic capture**.
5. Redeploy or restart staging so it picks up the variables. Sign in, open **Billing**, and keep two windows open: the
   Billing page and the Razorpay Dashboard (*Transactions → Payments*, and *Webhooks → the webhook → event logs*).
6. A forged webhook must be rejected:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<staging-domain>/api/webhooks/razorpay \
     -H 'content-type: application/json' -H 'x-razorpay-signature: 00' -d '{"event":"payment.captured"}'
   ```

   **Expected:** `401`.

Test payment methods: UPI ID `success@razorpay` (succeeds) or `failure@razorpay` (fails). For cards, use a number from
Razorpay's *Test card details* page, any future expiry and any CVV, then choose **Success** or **Failure** on the mock
bank page. In test mode, *cancelling* on the bank page counts as a successful payment, so use **Failure** to test failures.

### 3.1 Successful payment with automatic capture

1. Note the balance. Click **Buy Starter** (₹199, 100 credits) and pay with `success@razorpay`.
2. **Expected in the app:** a "Payment confirmed — 100 credits added" toast; the balance is +100; Recent orders shows
   Starter **Paid**; the credit history shows a **Purchase** of +100.
3. **Expected in Razorpay:** the payment is **Captured** (not just *Authorized*) within seconds, and the webhook log shows
   `payment.captured` and `order.paid` delivered with response **200**.
4. **Database:**

   ```js
   db.orders.find({}, { status: 1, fulfillmentStatus: 1, providerPaymentId: 1, amount: 1 }).sort({ createdAt: -1 }).limit(1)
   // → status "paid", fulfillmentStatus "fulfilled", providerPaymentId "pay_…", amount 19900
   db.credittransactions.countDocuments({ idempotencyKey: "order:<that order _id>" })   // → 1
   ```

5. **Webhook-only fulfilment** (shows credits still arrive if the browser drops out): in Chrome DevTools → Network →
   right-click → *Block request URL* → pattern `*/verify`. Buy Starter again and pay. **Expected:** the toast reports a
   confirmation problem, but within a few seconds (refresh Billing) the credits arrive through the webhook. Unblock
   the URL afterwards.
6. **Replay:** in the webhook's event log, re-send a delivered `payment.captured` event. **Expected:** 200, no change in
   balance (exactly-once crediting).

### 3.2 Failed payment

1. Click **Buy Starter**, pay with `failure@razorpay` (or a test card + **Failure**).
2. **Expected:** Razorpay shows the failure (you may retry inside the modal); the app shows the failure message; no
   credits are added. After you close the modal, the order is **Failed** or **Cancelled**, never Paid, and the webhook log
   shows `payment.failed` with 200.
3. Open checkout and close it without paying. **Expected:** order **Cancelled**, no credits.

### 3.3 Manual capture (optional — only if you plan to use it)

1. Switch the Dashboard to manual capture. Buy Starter and pay.
2. **Expected:** the app says the payment isn't completed yet and credits will follow; the order stays *Awaiting payment*.
3. In the Dashboard, open the payment → **Capture**. **Expected:** `payment.captured` → 200, and the credits arrive.
4. Leave one payment uncaptured past the capture timeout (minimum 12 minutes). Razorpay auto-refunds it.
   **Expected:** a refund webhook → 200; the order becomes **Refunded**; no credits were granted and none are taken.
5. Switch back to **automatic capture**.

### 3.4 Refund reconciliation

Use orders from 3.1. Refunds are issued from Razorpay: *Transactions → Payments → the payment → Issue Refund*.

1. **Full refund:** refund the whole ₹199 of a Starter purchase.
   **Expected:** the webhook log shows `refund.created` and/or `refund.processed` → 200; the balance drops by 100 (or to
   0 if fewer remain); the order shows **Refunded**; the credit history shows **Payment refund −100**.

   ```js
   db.orders.findOne({ providerPaymentId: "pay_…" }, { status: 1, refundedAmount: 1, refunds: 1 })
   // → status "refunded", refundedAmount 19900,
   //   refunds: [{ refundId: "rfnd_…", status: "processed", reversal: "applied", creditsTarget: 100, creditsReversed: 100 }]
   db.credittransactions.find({ type: "reversal" }).sort({ createdAt: -1 }).limit(1)
   ```

2. **Partial refunds:** buy **Pro** (₹799, 550 credits) and refund ₹399.50. **Expected:** the order stays **Paid**
   with "₹399.50 refunded" and the balance drops by 275. Refund the remaining ₹399.50. **Expected:** **Refunded**,
   another −275 (550 in total).
3. **Credits already spent:** buy Starter, spend most of the credits generating, then fully refund. **Expected:** the
   balance goes to **0**, never negative; the server log has `[refunds] credits already spent…`; in the database,
   `creditsReversed < creditsTarget` for that refund.
4. **Replays:** re-send a refund event from the webhook log. **Expected:** 200, no further change.
5. **Not testable on demand:** `refund.failed`. Razorpay can't be made to fail a refund in test mode. The restore path
   (credits returned, order back to Paid) is covered by the integration tests.

### 3.5 Go-live check (live mode, after activation)

1. Create **live** API keys and a **live-mode** webhook (same URL and events, a **new** secret). Set them in production.
2. Make one real purchase (Starter) with your own payment method. Check Captured, the 200 webhook deliveries, and the
   credits.
3. Refund it fully from the Dashboard and check the reconciliation as in 3.4 step 1.

**Pass when:** 3.1, 3.2 and 3.4 behave as described in test mode, and 3.5 passes in live mode.

---

## 4. Bot check, CSP and security headers on the deployed site

1. **Turnstile** (real keys from [DEPLOYMENT.md §6](DEPLOYMENT.md#6-cloudflare-turnstile), not the test keys):
   - /signup, /login and /forgot-password show the widget, and the submit button enables once it passes.
   - The API refuses requests without a valid token:

     ```bash
     curl -sS -X POST https://<domain>/api/auth/login -H 'content-type: application/json' \
       -H 'origin: https://<domain>' -d '{"email":"a@example.com","password":"x"}'
     # → 400 {"error":{"code":"BOT_CHECK_REQUIRED",…}}
     curl -sS -X POST https://<domain>/api/auth/login -H 'content-type: application/json' \
       -H 'origin: https://<domain>' -d '{"email":"a@example.com","password":"x","turnstileToken":"forged"}'
     # → 400 {"error":{"code":"BOT_CHECK_FAILED",…}}
     ```

2. **CSP:** with DevTools open on the landing page, /signup, /login, /billing (complete a test checkout) and /write,
   the Console shows **no** `Refused to load…` / `Refused to execute…` messages. If you set `CSP_REPORT_URI`, the
   collector should receive nothing during these flows.
3. **Headers:**

   ```bash
   curl -sI https://<domain>/login | grep -iE 'content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy'
   ```

   **Expected:** all five present; the CSP contains `'nonce-…'`, `'strict-dynamic'` and `upgrade-insecure-requests`.

## 5. Google sign-in (only if enabled)

Sign up with Google using a new Google account, sign out, sign in again, and use **Continue with Google** with an email
that already has a password account. **Expected:** you land on the dashboard each time; the existing account is linked,
not duplicated (`db.users.countDocuments({ email: "<that email>" })` → 1).
