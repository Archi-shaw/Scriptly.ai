# Database reference (MongoDB / Mongoose)

Connection: `lib/db.ts` caches one Mongoose connection per process (safe for hot reload and serverless). Indexes are created
by Mongoose on startup and by `npm run db:seed`. Multi-document updates use transactions when the deployment supports them
(replica set / Atlas); on a standalone server the code falls back to conditional updates and unique keys.

## Collections

### `users` — `models/User.ts`
| Field | Notes |
| --- | --- |
| `name`, `email` | `email` unique, lowercased |
| `passwordHash` | bcrypt (cost 12), `select: false`; absent for Google-only accounts |
| `emailVerified`, `emailVerifiedAt` | Accounts are created only after verification |
| `googleId`, `image` | Optional Google link (`googleId` unique, sparse) |
| `status` | `active` \| `suspended` |
| `role` | `user` \| `admin` |
| `availableCredits`, `totalCreditsEarned`, `totalCreditsUsed` | Changed only via `lib/credits.ts`; never negative |
| `sessionVersion` | Incremented to revoke all sessions |
| `lastLoginAt`, `passwordChangedAt`, timestamps | |

### `authchallenges` — one-time verification codes
`_id` = SHA-256 of the browser's opaque challenge token · `purpose` (`signup` \| `login` \| `password_reset` \| `email_change`) ·
`email` · `userId?` · `codeHash` (HMAC of the code) · `attempts`, `sendCount`, `lastSentAt`, `expiresAt`, `consumedAt` ·
`payload` (pending signup name + password hash, or requested new email) · `ip`, `userAgent` · `purgeAt` (**TTL index**).
Indexes: `{ email, purpose }`, TTL on `purgeAt`.

### `ratelimits`
`_id` = `<scope>:<identifier>:<window>:<windowStart>` · `count` · `expiresAt` (**TTL index**). Atomic upsert + `$inc`.
Email addresses in identifiers are stored as truncated SHA-256 hashes.

### `creditpackages`
`slug` (unique) · `name` · `description` · `credits` · `bonusCredits` · `priceMinor` (integer minor units) · `currency` ·
`features[]` · `isActive` · `isPopular` · `sortOrder`. Index `{ isActive, sortOrder }`.

### `credittransactions` — append-only ledger
`userId` · `type` (`bonus` \| `purchase` \| `usage` \| `refund` \| `reversal` \| `adjustment`) · `amount` (signed, non-zero integer) ·
`balanceBefore` / `balanceAfter` · `status` · `description` · `orderId?` · `contentId?` · `idempotencyKey` (**unique, sparse**).
Keys used: `signup-bonus:<userId>`, `gen:<generationId>`, `refund:<generationId>`, `order:<orderId>`, `admin:<uuid>`,
`payment-refund:<rfnd_id>` (credits taken back for a refunded payment, type `reversal`), `payment-refund-failed:<rfnd_id>`
(restored when that refund fails, type `adjustment`).
Index `{ userId, createdAt: -1 }`.

### `orders`
`userId` · `packageId` · `packageSnapshot { slug, name, credits, bonusCredits }` · `amount`, `currency` · `receipt` (unique) ·
`provider` · `providerOrderId` (unique, sparse) · `providerPaymentId` · `status` (`created` \| `paid` \| `failed` \| `cancelled` \|
`refunded`) · `fulfillmentStatus` (`pending` \| `fulfilled`) · `paidAt`, `fulfilledAt`, `failureReason` · `refundedAmount`
(minor units, refunds that haven't failed) · `refunds[] { refundId, amount, status (created|processed|failed), rangeStart,
reversal (pending|applied|restored|none), creditsTarget, creditsReversed, createdAt, updatedAt }`.
Indexes `{ userId, createdAt: -1 }`, `{ providerPaymentId }` (sparse).

### `generatedcontents` — generation history
`userId` · `kind` (`generate` \| `refine`) · `templateId`, `templateName`, `category`, `action?` · `inputs` · `language`, `tone`,
`style`, `length`, `framework`, `creativity`, `brandVoice`, `instructions` · `output`, `wordCount` · `status` (`pending` \|
`completed` \| `failed` \| `refunded`) · `errorCode`, `errorMessage` · `creditsUsed`, `creditsRefunded` · `provider`, `model`,
`usage`, `durationMs` · `requestId` · `documentId?`.
Indexes: `{ userId, requestId }` **unique** (idempotent requests), `{ userId, createdAt: -1 }`, `{ userId, kind, createdAt: -1 }`,
`{ status, createdAt }`.

### `documents` — saved, editable content
`userId` · `title` · `content` (≤ 200,000 chars) · `templateId`, `category`, `language`, `tone`, `framework` ·
`sourceGenerationId?` · `wordCount` · timestamps. Indexes: `{ userId, updatedAt: -1 }`, `{ userId, createdAt: -1 }`,
`{ userId, category, updatedAt: -1 }`.

## Invariants

- Every read and write of user content filters by `userId` — other users' records behave as "not found".
- A user's balance only changes together with a ledger entry; spending uses `availableCredits >= cost` in the update filter.
- A generation request (`userId + requestId`) is charged at most once; failures are refunded once (`refund:<id>`).
- A paid order credits at most once (`order:<id>`), whichever of the verify call or webhook arrives first.
- A refunded order is never credited again; each refund id is recorded once per order and reverses credits at most once,
  never below a zero balance.
- Verification codes are never stored in plain text and can be used once.

## Account deletion

Deleting an account removes the user, their documents, generation history and verification challenges. Orders and credit
transactions are retained for accounting; they reference only the user id.
