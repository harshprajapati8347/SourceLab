/**
 * Session type inferred from the Better Auth configuration.
 *
 * Express `Request` is augmented in `types/express.d.ts` so `req.session` uses this type.
 */

import type { auth } from "../lib/auth.js";

/**
 * Authenticated session shape including `user` and `session` metadata.
 *
 */
export type Session = typeof auth.$Infer.Session;
