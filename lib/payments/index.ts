import "server-only";
import { getRazorpayConfig } from "@/lib/config";
import { createRazorpayProvider } from "@/lib/payments/razorpay";
import type { PaymentProvider } from "@/lib/payments/types";

/** Returns the configured payment provider, or null when payments are not set up. */
export function getPaymentProvider(): PaymentProvider | null {
  const razorpay = getRazorpayConfig();
  return razorpay ? createRazorpayProvider(razorpay) : null;
}

export type { PaymentProvider } from "@/lib/payments/types";
