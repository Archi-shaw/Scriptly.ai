import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ZodError, ZodType } from "@/lib/zod";
import { DatabaseConfigError } from "@/lib/db";

/** An error that is safe to show to the client. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return ["MongooseServerSelectionError", "MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError"].includes(
    error.name,
  );
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    const headers = new Headers();
    const retryAfter = error.details?.retryAfter;
    if (error.status === 429 && typeof retryAfter === "number") headers.set("Retry-After", String(retryAfter));
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.status, headers },
    );
  }
  if (error instanceof DatabaseConfigError) {
    console.error("[api] database is not configured");
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "The service is not configured yet. Please try again later." } },
      { status: 503 },
    );
  }
  if (isDatabaseUnavailable(error)) {
    console.error("[api] database unavailable:", (error as Error).message);
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "We're having trouble reaching the database. Please try again shortly." } },
      { status: 503 },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Rejects cross-site state-changing requests. Browsers always send `Origin`
 * on cross-origin POST/PATCH/DELETE; server-to-server calls (webhooks) omit it.
 */
export function assertSameOrigin(req: NextRequest): void {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "FORBIDDEN_ORIGIN", "Cross-site request blocked.");
  }
  if (!host || originHost !== host) {
    throw new ApiError(403, "FORBIDDEN_ORIGIN", "Cross-site request blocked.");
  }
}

/** Wraps a route handler with origin checks and consistent error responses. */
export function apiRoute<Ctx>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<Response>,
  options: { skipOriginCheck?: boolean } = {},
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      if (!options.skipOriginCheck) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function validationError(error: ZodError): ApiError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return new ApiError(400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid input.", { fields });
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>, maxChars = 64_000): Promise<T> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected a JSON request body.");
  }
  const text = await req.text();
  if (text.length > maxChars) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

function header(headers: HeaderSource, name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Best-effort client IP. Relies on the reverse proxy / platform (e.g. Vercel,
 * nginx) setting x-real-ip or x-forwarded-for.
 */
export function clientIpFromHeaders(headers: HeaderSource): string {
  const realIp = header(headers, "x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  const forwarded = header(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 64);
  return "unknown";
}

export function getClientIp(req: NextRequest | Request): string {
  return clientIpFromHeaders(req.headers);
}

export function getUserAgent(req: NextRequest | Request): string {
  return (req.headers.get("user-agent") ?? "").slice(0, 512);
}

export function notFound(message = "Not found."): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}
