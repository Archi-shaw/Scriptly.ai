/**
 * Administrative credit adjustment (support, promotions, QA). Runs with direct
 * database access — there is deliberately no HTTP endpoint for this.
 *
 *   npm run credits:grant -- user@example.com 100 "Support goodwill"
 *   npm run credits:grant -- user@example.com -20 "Correction"
 */
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

async function main() {
  const [email, rawAmount, ...reasonParts] = process.argv.slice(2);
  const amount = Number(rawAmount);
  if (!email || !Number.isInteger(amount) || amount === 0) {
    console.error('Usage: npm run credits:grant -- <email> <non-zero integer> ["reason"]');
    process.exit(1);
  }

  const { default: dbConnect } = await import("@/lib/db");
  const { changeCredits } = await import("@/lib/credits");
  const { default: User } = await import("@/models/User");

  await dbConnect();
  const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const result = await changeCredits({
    userId: user._id,
    amount,
    type: "adjustment",
    description: reasonParts.join(" ") || "Manual credit adjustment",
    idempotencyKey: `admin:${randomUUID()}`,
  });
  console.log(`${amount > 0 ? "Granted" : "Removed"} ${Math.abs(amount)} credits for ${user.email}. New balance: ${result.balance}.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
