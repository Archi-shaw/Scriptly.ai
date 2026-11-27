import { z } from "@/lib/zod";
import { ApiError, apiRoute, notFound, ok, readJson } from "@/lib/api";
import dbConnect, { isValidObjectId } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fulfillOrder, serializeOrder } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";
import { PaymentProviderError } from "@/lib/payments/types";
import { enforceRateLimits } from "@/lib/rate-limit";
import Order from "@/models/Order";
import User from "@/models/User";

const schema = z.object({
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});

/**
 * Confirms a checkout. The signature proves the response came from Razorpay,
 * and the payment is re-fetched from Razorpay's API before any credit is granted.
 */
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await params;
  if (!isValidObjectId(id)) throw notFound("Order not found.");
  const body = await readJson(req, schema);

  const provider = getPaymentProvider();
  if (!provider) throw new ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Online payments are not enabled on this server.");
  await enforceRateLimits([{ key: `orders:verify:${user._id.toString()}`, limit: 20, windowSeconds: 600 }]);

  await dbConnect();
  const order = await Order.findOne({ _id: id, userId: user._id }).lean();
  if (!order) throw notFound("Order not found.");
  if (!order.providerOrderId || order.providerOrderId !== body.razorpay_order_id) {
    throw new ApiError(400, "PAYMENT_MISMATCH", "This payment does not belong to the order.");
  }
  if (
    !provider.verifyCheckoutSignature({
      providerOrderId: order.providerOrderId,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    })
  ) {
    throw new ApiError(400, "INVALID_SIGNATURE", "Payment verification failed.");
  }

  let payment;
  try {
    payment = await provider.fetchPayment(body.razorpay_payment_id);
  } catch (error) {
    console.error("[orders] could not fetch payment:", error instanceof PaymentProviderError ? error.message : error);
    throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "We couldn't confirm the payment yet. Credits will be added automatically once it's confirmed.");
  }

  const { order: fulfilled } = await fulfillOrder(order._id, payment);
  const fresh = await User.findById(user._id).select("availableCredits").lean();
  return ok({ order: serializeOrder(fulfilled), credits: fresh?.availableCredits ?? null });
});
