import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/lib/db";
import { ApiError } from "@/lib/api";
import { fulfillOrder } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";
import { handleRefundEvent, type RefundEvent } from "@/lib/refunds";
import Order from "@/models/Order";

interface RazorpayWebhook {
  event?: string;
  payload?: {
    payment?: { entity?: { id: string; order_id: string; status: string; amount: number; currency: string; error_description?: string } };
    refund?: { entity?: { id: string; payment_id: string; amount: number; currency: string } };
  };
}

const REFUND_EVENTS = new Set<string>(["refund.created", "refund.processed", "refund.failed"]);

async function processEvent(event: RazorpayWebhook): Promise<Record<string, unknown>> {
  const payment = event.payload?.payment?.entity;

  if (event.event && REFUND_EVENTS.has(event.event)) {
    const refund = event.payload?.refund?.entity;
    if (!refund?.id || !refund.payment_id) return { ignored: "no refund entity" };
    const outcome = await handleRefundEvent(
      event.event as RefundEvent,
      { id: refund.id, paymentId: refund.payment_id, amount: refund.amount, currency: refund.currency },
      payment?.order_id,
    );
    return { result: outcome.result };
  }

  if (!payment?.order_id) return { ignored: "no payment entity" };
  await dbConnect();
  const order = await Order.findOne({ providerOrderId: payment.order_id }).lean();
  if (!order) return { ignored: "unknown order" };

  if (event.event === "payment.captured" || event.event === "order.paid") {
    await fulfillOrder(order._id, {
      id: payment.id,
      orderId: payment.order_id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
    });
  } else if (event.event === "payment.failed" && order.fulfillmentStatus !== "fulfilled") {
    await Order.updateOne(
      { _id: order._id, status: { $in: ["created", "cancelled"] } },
      { $set: { status: "failed", failureReason: (payment.error_description ?? "Payment failed").slice(0, 300) } },
    );
  }
  return {};
}

/**
 * Razorpay webhook. Subscribe to: payment.captured, payment.failed, order.paid,
 * refund.created, refund.processed, refund.failed.
 * The raw body's HMAC signature is verified before anything is trusted.
 */
export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider || !provider.webhookConfigured) {
    return NextResponse.json({ error: { code: "WEBHOOK_NOT_CONFIGURED" } }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!provider.verifyWebhookSignature(rawBody, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE" } }, { status: 401 });
  }

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
  }

  try {
    return NextResponse.json({ received: true, ...(await processEvent(event)) });
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) {
      // Permanent problem (e.g. amount mismatch): acknowledge so Razorpay stops retrying; it's logged.
      console.error("[webhook:razorpay] rejected event:", event.event, error.code, error.message);
      return NextResponse.json({ received: true, error: error.code });
    }
    console.error("[webhook:razorpay] processing failed", error);
    // 500 makes Razorpay retry later; fulfilment and refunds are idempotent.
    return NextResponse.json({ error: { code: "PROCESSING_FAILED" } }, { status: 500 });
  }
}
