import type { ZodError } from "@/lib/zod";

/** First error message per field, keyed by field path (for inline form errors). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
