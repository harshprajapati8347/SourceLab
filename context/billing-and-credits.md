# Billing and Credits

SourceLab bills through Better Auth’s Stripe plugin (one **Pro** subscription). Usage is gated by a **custom credit counter on `User`** — not Stripe balances, meters, or a ledger table.

## Plan config

Canonical constants: `server/src/config/plans.ts`

| Plan | Stripe | Credits | Price |
| --- | --- | --- | --- |
| Free | No Product/Price/Checkout. `User.plan = "free"`. A Stripe Customer may still be created on signup (`createCustomerOnSignUp: true`). | `10` once, never refills | ₹0 |
| Pro | Better Auth plan name `"pro"`, price from `STRIPE_PRO_PRICE_ID` | `500` per billing period, **hard reset** (overwrite, no rollover) | ₹499/month |

Both tiers have the same product surface (workspaces, sources, RAG chat, learning tools, memory). The only difference is the credit ceiling. Do not gate features on `User.plan === "pro"`.

### Credit costs

| Action | When deducted | Amount |
| --- | --- | --- |
| Chat user message | Start of `streamWorkspaceChat`, before RAG embeddings and the LLM stream | `0.1` |
| Learning artifact | Start of `createArtifactForWorkspace`, before Inngest generation | `1` |
| Source processed | After embeddings upsert, immediately before status `READY` | `1` |

Source **create/reprocess** also **preflights** `credits >= 1` so empty-balance users cannot enqueue work. If two sources race with one credit, one succeeds at `READY` and the other fails with `402` after embeddings.

Not charged: conversation summarization, auto-title, Mem0.

## Schema

On `User` (`server/prisma/schema.prisma`):

- `credits Decimal @default(10) @db.Decimal(12, 1)` — must match `PLANS.free.credits`
- `plan String @default("free")` — `"free"` \| `"pro"` (our product plan, **not** `Subscription.plan`)
- `stripeCustomerId String?` — Better Auth Stripe plugin

`Subscription` is the Better Auth Stripe plugin table (`@@map("subscription")`). Do not treat `Subscription.plan` as the usage-gate plan; that lives on `User.plan`.

## Lifecycle (Inngest, not the webhook handler)

Stripe webhooks are handled by Better Auth at `POST /api/auth/stripe/webhook` (Express, mounted **before** `express.json()`). Hooks only `inngest.send("billing/credits.apply")`. Writes run in `applyBillingCredits` → `applyCreditLifecycle`:

| Action | Trigger | Effect |
| --- | --- | --- |
| `activate_pro` | `onSubscriptionComplete` | `plan = "pro"`, `credits = 500` |
| `renew_pro` | `invoice.paid` with `billing_reason === "subscription_cycle"` | same hard reset |
| `downgrade_free` | `onSubscriptionDeleted` (subscription **ended**, not merely `cancel_at_period_end`) | `plan = "free"` only; leave `credits` as-is |

Activate/renew are idempotent overwrites. Do not reset credits on every `customer.subscription.updated`.

Local webhook forward (API host, not Next.js):

```bash
stripe listen --forward-to localhost:8080/api/auth/stripe/webhook
```

Production: point Stripe at the Express API origin, same path. Required events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, **`invoice.paid`**.

## Enforcement

`server/src/services/credits.service.ts`:

- `checkAndDeductCredits(userId, amount)` — `updateMany` where `credits >= amount`, then decrement. `count === 0` → `PaymentRequiredError` **402** with `{ code: "INSUFFICIENT_CREDITS" }` and message `You're out of credits. Upgrade to Pro.`
- `assertMinimumCredits` — read-only preflight for source ingest

Call sites: `chat.service.ts`, `artifact.service.ts`, `source.service.ts` (preflight), `source-processing.service.ts` (deduct on success).

Client: `GET /api/billing/me` (auth), `GET /api/billing/plans` (public). Upgrade/portal via `authClient.subscription.upgrade` / `billingPortal`. Credits UI: `CreditsBadge`, `/settings/billing`, `/pricing`.

## Env

`RESEND_API_KEY`, `RESEND_FROM_EMAIL` — verification and password reset (console fallback if unset).

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` — if any is missing, the Stripe plugin is not registered and checkout will fail.

Create the Pro Product + ₹499/month INR Price in Stripe test mode yourself; never hardcode a price id. `STRIPE_PRO_PRICE_ID` must be a Stripe **Price** id (`price_…`), not a Product id (`prod_…`). Amount and currency on a Price cannot be edited — create a new Price and point the env var at it if the charge amount changes.
