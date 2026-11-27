import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createRazorpayProvider } from "@/lib/payments/razorpay";
import { ApiError, assertSameOrigin, clientIpFromHeaders, readJson } from "@/lib/api";
import { countWords, deriveTitle, excerpt, markdownToPlainText } from "@/lib/text";
import { loginSchema } from "@/lib/validation";

const cfg = { keyId: "rzp_test_key", keySecret: "key-secret", webhookSecret: "hook-secret" };

describe("Razorpay integration boundary", () => {
  const provider = createRazorpayProvider(cfg, vi.fn() as unknown as typeof fetch);

  it("verifies checkout signatures (order_id|payment_id HMAC)", () => {
    const signature = createHmac("sha256", "key-secret").update("order_1|pay_1").digest("hex");
    expect(provider.verifyCheckoutSignature({ providerOrderId: "order_1", paymentId: "pay_1", signature })).toBe(true);
    expect(provider.verifyCheckoutSignature({ providerOrderId: "order_1", paymentId: "pay_2", signature })).toBe(false);
    expect(provider.verifyCheckoutSignature({ providerOrderId: "order_1", paymentId: "pay_1", signature: "not-hex" })).toBe(false);
  });

  it("verifies webhook signatures over the raw body", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = createHmac("sha256", "hook-secret").update(body).digest("hex");
    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(`${body} `, signature)).toBe(false);
    expect(provider.verifyWebhookSignature(body, null)).toBe(false);
    const noSecret = createRazorpayProvider({ ...cfg, webhookSecret: undefined }, vi.fn() as unknown as typeof fetch);
    expect(noSecret.verifyWebhookSignature(body, signature)).toBe(false);
  });

  it("creates orders with server-side credentials and exposes only the public key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "order_abc" }), { status: 200 }));
    const p = createRazorpayProvider(cfg, fetchMock as unknown as typeof fetch);
    expect(await p.createOrder({ amount: 19900, currency: "INR", receipt: "r1", notes: {} })).toEqual({ providerOrderId: "order_abc" });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_key:key-secret").toString("base64")}`);
    const session = p.checkoutSession({ providerOrderId: "order_abc", amount: 19900, currency: "INR" });
    expect(JSON.stringify(session)).not.toContain("key-secret");
  });
});

describe("API guards", () => {
  const request = (headers: Record<string, string>, method = "POST", body?: string) =>
    new NextRequest("http://localhost:3000/api/x", { method, headers, body });

  it("blocks cross-site state-changing requests", () => {
    expect(() => assertSameOrigin(request({ origin: "http://localhost:3000", host: "localhost:3000" }))).not.toThrow();
    expect(() => assertSameOrigin(request({ origin: "https://evil.example", host: "localhost:3000" }))).toThrowError(ApiError);
    expect(() => assertSameOrigin(request({ host: "localhost:3000" }))).not.toThrow(); // server-to-server
    expect(() => assertSameOrigin(request({ origin: "https://evil.example", host: "localhost:3000" }, "GET"))).not.toThrow();
  });

  it("validates JSON bodies with consistent errors", async () => {
    await expect(readJson(request({ "content-type": "text/plain" }, "POST", "{}"), loginSchema)).rejects.toMatchObject({ status: 415 });
    await expect(readJson(request({ "content-type": "application/json" }, "POST", "{bad"), loginSchema)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_JSON",
    });
    await expect(readJson(request({ "content-type": "application/json" }, "POST", JSON.stringify({ email: "x" })), loginSchema)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
    await expect(readJson(request({ "content-type": "application/json" }, "POST", "x".repeat(70_000)), loginSchema)).rejects.toMatchObject({ status: 413 });
  });

  it("derives the client IP from proxy headers", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" }))).toBe("5.6.7.8");
    expect(clientIpFromHeaders({ "x-forwarded-for": "9.9.9.9" })).toBe("9.9.9.9");
    expect(clientIpFromHeaders(undefined)).toBe("unknown");
  });
});

describe("text utilities", () => {
  it("counts words, including CJK text", () => {
    expect(countWords("Hello world, this is **Scriptly**.")).toBe(5);
    expect(countWords("# Heading\n\n- one\n- two")).toBe(3);
    expect(countWords("你好世界")).toBe(4);
    expect(countWords("")).toBe(0);
  });

  it("converts Markdown to plain text for exports and previews", () => {
    const md = "# Title\n\nSome **bold** and *italic* with a [link](https://x.y).\n\n- item";
    expect(markdownToPlainText(md)).toBe("Title\n\nSome bold and italic with a link (https://x.y).\n\n• item");
    expect(excerpt("# T\n\n" + "word ".repeat(100), 30).length).toBeLessThanOrEqual(30);
  });

  it("derives a document title from content", () => {
    expect(deriveTitle("# My Great Post\n\nBody")).toBe("My Great Post");
    expect(deriveTitle("Just a first line\nMore")).toBe("Just a first line");
    expect(deriveTitle("", "Fallback")).toBe("Fallback");
  });
});
