import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";
import { verifyHuman } from "@/lib/auth/turnstile";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("content security policy", () => {
  it("allows scripts only with the request nonce (no inline or eval in production)", () => {
    const policy = directives(buildContentSecurityPolicy({ nonce: "abc123==" }));
    const scripts = policy.get("script-src")!;
    expect(scripts).toContain("'nonce-abc123=='");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("default-src")).toEqual(["'self'"]);
  });

  it("permits exactly the payment and bot-check frames the app uses", () => {
    const policy = directives(buildContentSecurityPolicy({ nonce: "n" }));
    expect(policy.get("frame-src")).toEqual(["https://*.razorpay.com", "https://challenges.cloudflare.com"]);
    expect(policy.get("connect-src")).toEqual(["'self'", "https://*.razorpay.com"]);
  });

  it("adds dev-only allowances and optional directives only when asked", () => {
    const dev = directives(buildContentSecurityPolicy({ nonce: "n", dev: true }));
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
    expect(dev.get("connect-src")).toContain("ws:");

    const prod = buildContentSecurityPolicy({ nonce: "n" });
    expect(prod).not.toContain("upgrade-insecure-requests");
    expect(prod).not.toContain("report-uri");

    const https = buildContentSecurityPolicy({ nonce: "n", upgradeInsecureRequests: true, reportUri: "https://csp.example.com/r" });
    expect(https).toContain("upgrade-insecure-requests");
    expect(https).toContain("report-uri https://csp.example.com/r");
    // A malformed report URI can't inject directives.
    expect(buildContentSecurityPolicy({ nonce: "n", reportUri: "https://x.example; script-src *" })).not.toContain("report-uri");
  });

  it("creates unpredictable 128-bit nonces", () => {
    const nonces = new Set(Array.from({ length: 200 }, createNonce));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("Turnstile verification", () => {
  afterEach(() => {
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  const enable = () => {
    process.env.TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
  };
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("does nothing when Turnstile isn't configured", async () => {
    const fetchImpl = vi.fn();
    await expect(verifyHuman(undefined, { action: "signup" }, fetchImpl)).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses to run half-configured", async () => {
    process.env.TURNSTILE_SITE_KEY = "only-the-site-key";
    await expect(verifyHuman("token", { action: "signup" }, vi.fn())).rejects.toMatchObject({ status: 503, code: "BOT_CHECK_MISCONFIGURED" });
  });

  it("requires a token once enabled", async () => {
    enable();
    await expect(verifyHuman(undefined, { action: "login" }, vi.fn())).rejects.toMatchObject({ status: 400, code: "BOT_CHECK_REQUIRED" });
  });

  it("sends the secret, token and client IP to siteverify and accepts a valid token", async () => {
    enable();
    const fetchImpl = reply({ success: true, action: "login" });
    await verifyHuman("tok", { action: "login", ip: "203.0.113.9" }, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret-key");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.9");
  });

  it("rejects failed tokens and tokens issued for another form", async () => {
    enable();
    await expect(verifyHuman("tok", { action: "signup" }, reply({ success: false, "error-codes": ["timeout-or-duplicate"] }))).rejects.toMatchObject({
      status: 400,
      code: "BOT_CHECK_FAILED",
    });
    await expect(verifyHuman("tok", { action: "signup" }, reply({ success: true, action: "login" }))).rejects.toMatchObject({
      code: "BOT_CHECK_FAILED",
    });
  });

  it("fails closed when Cloudflare can't be reached", async () => {
    enable();
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(verifyHuman("tok", { action: "signup" }, offline)).rejects.toMatchObject({ status: 503, code: "BOT_CHECK_UNAVAILABLE" });
    await expect(verifyHuman("tok", { action: "signup" }, reply({}, 500))).rejects.toMatchObject({ status: 503, code: "BOT_CHECK_UNAVAILABLE" });
  });
});
