import "server-only";
import type { ClientSession, Types } from "mongoose";
import dbConnect, { isDuplicateKeyError, withOptionalTransaction } from "@/lib/db";
import { ApiError } from "@/lib/api";
import User from "@/models/User";
import CreditTransaction, { type CreditTransactionType } from "@/models/CreditTransaction";

export class InsufficientCreditsError extends ApiError {
  constructor(required: number, available: number) {
    super(
      402,
      "INSUFFICIENT_CREDITS",
      `This needs ${required} credit${required === 1 ? "" : "s"}, but you have ${available}. Top up your credits to continue.`,
      { required, available },
    );
  }
}

export interface CreditChange {
  userId: Types.ObjectId | string;
  /** Signed: positive adds credits, negative spends them. */
  amount: number;
  type: CreditTransactionType;
  description: string;
  /** Unique per logical operation; retries with the same key are applied once. */
  idempotencyKey: string;
  orderId?: Types.ObjectId | string;
  contentId?: Types.ObjectId | string;
}

export interface CreditChangeResult {
  balance: number;
  transactionId: string;
  duplicate: boolean;
}

function counterUpdates(change: CreditChange): Record<string, number> {
  const inc: Record<string, number> = { availableCredits: change.amount };
  if (change.type === "usage" || change.type === "refund") {
    // usage (negative) increases "used"; a refund (positive) gives it back.
    inc.totalCreditsUsed = -change.amount;
  } else if (change.type === "reversal") {
    // A refunded purchase (negative) no longer counts as earned.
    inc.totalCreditsEarned = change.amount;
  } else if (change.amount > 0) {
    inc.totalCreditsEarned = change.amount;
  }
  return inc;
}

/**
 * Applies one ledgered balance change. Spending uses a conditional update
 * (`availableCredits >= cost`) so concurrent requests can never overdraw.
 * Exported for composition inside a larger transaction (e.g. signup).
 */
export async function applyCreditChange(change: CreditChange, session: ClientSession | null): Promise<CreditChangeResult> {
  if (!Number.isInteger(change.amount) || change.amount === 0) {
    throw new Error("Credit change amount must be a non-zero integer");
  }

  const existing = await CreditTransaction.findOne({ idempotencyKey: change.idempotencyKey }).session(session).lean();
  if (existing) {
    return { balance: existing.balanceAfter, transactionId: existing._id.toString(), duplicate: true };
  }

  const inc = counterUpdates(change);
  const filter =
    change.amount < 0 ? { _id: change.userId, availableCredits: { $gte: -change.amount } } : { _id: change.userId };
  const user = await User.findOneAndUpdate(filter, { $inc: inc }, { new: true, session })
    .select("availableCredits")
    .lean();

  if (!user) {
    const current = await User.findById(change.userId).select("availableCredits").session(session).lean();
    if (!current) throw new ApiError(404, "USER_NOT_FOUND", "Account not found.");
    throw new InsufficientCreditsError(-change.amount, current.availableCredits);
  }

  try {
    const [transaction] = await CreditTransaction.create(
      [
        {
          userId: change.userId,
          type: change.type,
          amount: change.amount,
          balanceBefore: user.availableCredits - change.amount,
          balanceAfter: user.availableCredits,
          description: change.description,
          idempotencyKey: change.idempotencyKey,
          orderId: change.orderId,
          contentId: change.contentId,
        },
      ],
      { session },
    );
    return { balance: user.availableCredits, transactionId: transaction._id.toString(), duplicate: false };
  } catch (error) {
    if (!session && isDuplicateKeyError(error)) {
      // No transaction available and a concurrent call with the same key won:
      // compensate our balance change so the operation is applied exactly once.
      const undo = Object.fromEntries(Object.entries(inc).map(([key, value]) => [key, -value]));
      await User.updateOne({ _id: change.userId }, { $inc: undo });
    }
    throw error;
  }
}

export async function changeCredits(change: CreditChange): Promise<CreditChangeResult> {
  await dbConnect();
  try {
    return await withOptionalTransaction((session) => applyCreditChange(change, session));
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const winner = await CreditTransaction.findOne({ idempotencyKey: change.idempotencyKey }).lean();
    if (!winner) throw error;
    return { balance: winner.balanceAfter, transactionId: winner._id.toString(), duplicate: true };
  }
}

export function chargeCredits(
  userId: Types.ObjectId | string,
  amount: number,
  options: { description: string; idempotencyKey: string; contentId?: Types.ObjectId | string },
): Promise<CreditChangeResult> {
  return changeCredits({ userId, amount: -Math.abs(amount), type: "usage", ...options });
}

export function refundCredits(
  userId: Types.ObjectId | string,
  amount: number,
  options: { description: string; idempotencyKey: string; contentId?: Types.ObjectId | string },
): Promise<CreditChangeResult> {
  return changeCredits({ userId, amount: Math.abs(amount), type: "refund", ...options });
}

/**
 * Takes back up to `maxAmount` credits without going below zero (used when a
 * payment is refunded). Credits already spent can't be recovered, so this
 * returns how many were actually reversed. Idempotent per key.
 */
export async function reverseCredits(
  userId: Types.ObjectId | string,
  maxAmount: number,
  options: { description: string; idempotencyKey: string; orderId?: Types.ObjectId | string },
): Promise<{ reversed: number; balance: number; duplicate: boolean }> {
  await dbConnect();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await CreditTransaction.findOne({ idempotencyKey: options.idempotencyKey }).lean();
    if (existing) return { reversed: -existing.amount, balance: existing.balanceAfter, duplicate: true };

    const user = await User.findById(userId).select("availableCredits").lean();
    if (!user) return { reversed: 0, balance: 0, duplicate: false }; // account deleted: nothing to take back
    const amount = Math.min(Math.floor(maxAmount), user.availableCredits);
    if (amount <= 0) return { reversed: 0, balance: user.availableCredits, duplicate: false };

    try {
      const result = await changeCredits({ userId, amount: -amount, type: "reversal", ...options });
      if (!result.duplicate) return { reversed: amount, balance: result.balance, duplicate: false };
      // A concurrent call with the same key won: loop to report its result.
    } catch (error) {
      // The balance dropped between the read and the update: recompute.
      if (!(error instanceof InsufficientCreditsError)) throw error;
    }
  }
  throw new Error("Credit reversal did not settle: the balance kept changing");
}

export function grantCredits(
  userId: Types.ObjectId | string,
  amount: number,
  options: {
    type: "bonus" | "purchase" | "adjustment";
    description: string;
    idempotencyKey: string;
    orderId?: Types.ObjectId | string;
  },
): Promise<CreditChangeResult> {
  return changeCredits({ userId, amount, ...options });
}
