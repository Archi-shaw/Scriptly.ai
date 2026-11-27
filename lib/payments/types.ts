export interface ProviderPayment {
  id: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
}

/** Data the browser needs to open the provider's checkout. Contains no secrets. */
export interface CheckoutSession {
  provider: "razorpay";
  keyId: string;
  providerOrderId: string;
  amount: number;
  currency: string;
}

/**
 * Integration boundary for payment providers. Credits are granted only after
 * `verifyCheckoutSignature` + `fetchPayment` confirm a captured payment, or a
 * webhook passes `verifyWebhookSignature`.
 */
export interface PaymentProvider {
  readonly id: "razorpay";
  createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<{ providerOrderId: string }>;
  checkoutSession(order: { providerOrderId: string; amount: number; currency: string }): CheckoutSession;
  verifyCheckoutSignature(input: { providerOrderId: string; paymentId: string; signature: string }): boolean;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  readonly webhookConfigured: boolean;
}

export class PaymentProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
