import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";

const PROTECTED_PREFIXES = ["/dashboard", "/write", "/templates", "/documents", "/history", "/billing", "/settings"];
const AUTH_PAGES = ["/login", "/signup"];

const isProtected = (pathname: string) => PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Runs for every page request:
 * 1. Redirects signed-out visitors away from workspace pages (first line of
 *    defence only — the (app) layout and every API route verify the session
 *    against the database too).
 * 2. Applies a nonce-based Content-Security-Policy. Next.js picks the nonce up
 *    from the request header and adds it to the scripts it renders.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const protectedPage = isProtected(pathname);
  const authPage = AUTH_PAGES.includes(pathname);

  if (protectedPage || authPage) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET });
    const signedIn = Boolean(token?.uid);

    if (!signedIn && protectedPage) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }

    if (signedIn && authPage && !req.nextUrl.searchParams.has("reason")) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const nonce = createNonce();
  const policy = buildContentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV !== "production",
    upgradeInsecureRequests: (process.env.NEXTAUTH_URL ?? "").startsWith("https://"),
    reportUri: process.env.CSP_REPORT_URI,
  });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // CSP_REPORT_ONLY=true reports violations without blocking (for a cautious rollout).
  const headerName = process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  response.headers.set(headerName, policy);
  return response;
}

export const config = {
  // Every page, but not API routes, Next.js assets or files with an extension (public/).
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)"],
};
