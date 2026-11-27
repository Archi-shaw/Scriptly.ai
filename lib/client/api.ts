"use client";

import { signOut } from "next-auth/react";

/** Error thrown for non-2xx API responses, carrying the server's error code and field errors. */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  get fields(): Record<string, string> {
    const fields = this.details?.fields;
    return fields && typeof fields === "object" ? (fields as Record<string, string>) : {};
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "Please check your input and try again.",
  401: "Please sign in to continue.",
  403: "You don't have access to this.",
  404: "We couldn't find what you were looking for.",
  413: "That's too large to process.",
  429: "Too many requests. Please slow down.",
  500: "Something went wrong on our side. Please try again.",
  502: "A service we depend on had a problem. Please try again.",
  503: "The service is temporarily unavailable. Please try again shortly.",
  504: "That took too long. Please try again.",
};

let signingOut = false;

function handleRevokedSession() {
  if (signingOut || typeof window === "undefined") return;
  signingOut = true;
  void signOut({ callbackUrl: `/login?reason=session-expired&callbackUrl=${encodeURIComponent(window.location.pathname)}` });
}

export async function api<T>(
  url: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError(0, "NETWORK_ERROR", "Can't reach Scriptly. Check your internet connection and try again.");
  }

  let payload: { data?: T; error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code = payload?.error?.code ?? `HTTP_${response.status}`;
    if (response.status === 401 && (code === "SESSION_EXPIRED" || code === "UNAUTHENTICATED")) {
      handleRevokedSession();
    }
    throw new ApiClientError(
      response.status,
      code,
      payload?.error?.message ?? DEFAULT_MESSAGES[response.status] ?? "Something went wrong. Please try again.",
      payload?.error?.details,
    );
  }
  return payload?.data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Random id used to make AI requests idempotent across retries/double-clicks. */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
