import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";

/**
 * Integration suites need a disposable MongoDB database given explicitly via
 * TEST_MONGODB_URI (e.g. mongodb://127.0.0.1:27017/scriptly_test). Without it
 * they are skipped with a notice instead of guessing a database.
 */
export const hasTestDatabase = Boolean(process.env.TEST_MONGODB_URI);

export const describeWithDb = hasTestDatabase ? describe : describe.skip;

if (!hasTestDatabase) {
  console.warn("[tests] TEST_MONGODB_URI is not set — database integration suites are skipped.");
}

export function useTestDatabase() {
  beforeAll(async () => {
    const { default: dbConnect } = await import("@/lib/db");
    await dbConnect();
    const name = mongoose.connection.db?.databaseName ?? "";
    if (!/test/i.test(name)) {
      throw new Error(`Refusing to run destructive tests against database "${name}" (its name must contain "test").`);
    }
    // Register every model, then make sure unique indexes exist before tests rely on them.
    await Promise.all([
      import("@/models/User"),
      import("@/models/AuthChallenge"),
      import("@/models/RateLimit"),
      import("@/models/CreditPackage"),
      import("@/models/CreditTransaction"),
      import("@/models/Order"),
      import("@/models/GeneratedContent"),
      import("@/models/Document"),
    ]);
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });
}
