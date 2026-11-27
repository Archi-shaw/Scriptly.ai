"use client";

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

/** Loads Razorpay Checkout on demand (only when the user starts a purchase). */
export function loadRazorpay(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection or disable blockers and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export function openRazorpay(options: RazorpayOptions, onFailed: (message: string) => void) {
  if (!window.Razorpay) throw new Error("Payment window is not available.");
  const instance = new window.Razorpay(options);
  instance.on("payment.failed", (response) => onFailed(response.error?.description ?? "The payment failed."));
  instance.open();
}
