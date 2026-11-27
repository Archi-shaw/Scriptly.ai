import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RazorpayConfig } from "@/lib/config";
import { PaymentProviderError, type PaymentProvider, type ProviderPayment } from "@/lib/payments/types";

const API_BASE = "https://api.razorpay.com/v1";

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createRazorpayProvider(config: RazorpayConfig, fetchImpl: typeof fetch = fetch): PaymentProvider {
  const auth = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${API_BASE}${path}`, {
        ...init,
        headers: { Authorization: auth, "Content-Type": "application/json", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new PaymentProviderError(`Razorpay request failed: ${error instanceof Error ? error.message : "network error"}`);
    }
    const body = (await response.json().catch(() => null)) as (T & { error?: { description?: string } }) | null;
    if (!response.ok || !body) {
      throw new PaymentProviderError(body?.error?.description ?? `Razorpay responded with ${response.status}`, response.status);
    }
    return body;
  }

  return {
    id: "razorpay",
    webhookConfigured: Boolean(config.webhookSecret),

    async createOrder({ amount, currency, receipt, notes }) {
      const order = await call<{ id: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({ amount, currency, receipt, notes }),
      });
      return { providerOrderId: order.id };
    },

    checkoutSession({ providerOrderId, amount, currency }) {
      return { provider: "razorpay", keyId: config.keyId, providerOrderId, amount, currency };
    },

    verifyCheckoutSignature({ providerOrderId, paymentId, signature }) {
      return safeEqualHex(hmacHex(config.keySecret, `${providerOrderId}|${paymentId}`), signature);
    },

    async fetchPayment(paymentId): Promise<ProviderPayment> {
      const payment = await call<{ id: string; order_id: string; status: string; amount: number; currency: string }>(
        `/payments/${encodeURIComponent(paymentId)}`,
      );
      return {
        id: payment.id,
        orderId: payment.order_id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
      };
    },

    verifyWebhookSignature(rawBody, signature) {
      if (!config.webhookSecret || !signature) return false;
      return safeEqualHex(hmacHex(config.webhookSecret, rawBody), signature);
    },
  };
}
