import { z } from "zod";

/**
 * The single entry point for Zod in this app (enforced by ESLint).
 *
 * Zod's JIT compiles object parsers with `new Function`. Under the strict
 * Content-Security-Policy (no 'unsafe-eval'), even Zod's guarded probe for
 * that is reported by browsers as a CSP violation, so the JIT is turned off
 * before any schema is constructed. Configuring it here guarantees that,
 * because every module that builds schemas imports `z` from this file.
 */
z.config({ jitless: true });

export { z };
export type { ZodError, ZodType } from "zod";
