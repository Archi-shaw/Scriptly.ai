import { randomBytes } from "node:crypto";
import { z } from "@/lib/zod";
import { ApiError, apiRoute, ok, readJson, readQuery } from "@/lib/api";
import dbConnect from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { serializeOrder } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";
import { PaymentProviderError } from "@/lib/payments/types";
import { enforceRateLimits } from "@/lib/rate-limit";
import { paginate } from "@/lib/serializers";
import { objectIdSchema } from "@/lib/validation";
import CreditPackage from "@/models/CreditPackage";
import Order from "@/models/Order";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const GET = apiRoute(async (req) => {
  const user = await requireUser(req);
  const query = readQuery(req, listSchema);
  const filter = { userId: user._id };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return ok({ items: items.map(serializeOrder), ...paginate(query.page, query.limit, total) });
});

const createSchema = z.object({ packageId: objectIdSchema });

/**
 * Creates a pending order with the payment provider. Prices always come from
 * the database package, never from the client. No credits are granted here.
 */
export const POST = apiRoute(async (req) => {
  const user = await requireUser(req);
  const { packageId } = await readJson(req, createSchema);

  const provider = getPaymentProvider();
  if (!provider) {
    throw new ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Online payments are not enabled on this server yet.");
  }
  await enforceRateLimits(
    [{ key: `orders:create:${user._id.toString()}`, limit: 10, windowSeconds: 600 }],
    "Too many checkout attempts. Please wait a few minutes.",
  );

  await dbConnect();
  const pkg = await CreditPackage.findOne({ _id: packageId, isActive: true }).lean();
  if (!pkg) throw new ApiError(404, "PACKAGE_NOT_FOUND", "That credit package is no longer available.");

  const receipt = `scr_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const order = await Order.create({
    userId: user._id,
    packageId: pkg._id,
    packageSnapshot: { slug: pkg.slug, name: pkg.name, credits: pkg.credits, bonusCredits: pkg.bonusCredits ?? 0 },
    amount: pkg.priceMinor,
    currency: pkg.currency,
    receipt,
    provider: provider.id,
  });

  try {
    const { providerOrderId } = await provider.createOrder({
      amount: pkg.priceMinor,
      currency: pkg.currency,
      receipt,
      notes: { orderId: order._id.toString(), userId: user._id.toString(), package: pkg.slug },
    });
    await Order.updateOne({ _id: order._id }, { $set: { providerOrderId } });
    return ok(
      {
        orderId: order._id.toString(),
        checkout: provider.checkoutSession({ providerOrderId, amount: pkg.priceMinor, currency: pkg.currency }),
        package: { name: pkg.name, credits: pkg.credits + (pkg.bonusCredits ?? 0) },
        prefill: { name: user.name, email: user.email },
      },
      { status: 201 },
    );
  } catch (error) {
    const reason = error instanceof PaymentProviderError ? error.message : "Provider error";
    console.error("[orders] provider order creation failed:", reason);
    await Order.updateOne({ _id: order._id }, { $set: { status: "failed", failureReason: reason.slice(0, 300) } });
    throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", "We couldn't start the checkout. Please try again in a moment.");
  }
});
