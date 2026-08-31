/**
 * Stripe SDK client used by the Better Auth Stripe plugin.
 *
 * Null when `STRIPE_SECRET_KEY` is unset — the auth plugin is skipped in that case.
 */

import Stripe from "stripe";

export const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
