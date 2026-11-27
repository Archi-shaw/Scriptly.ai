/**
 * Prepares a database: builds all indexes and inserts the default credit packages.
 *
 *   npm run db:seed                 # create indexes + insert missing default packages
 *   npm run db:seed -- --update     # also overwrite existing default packages with the values in lib/packages.ts
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

async function main() {
  const update = process.argv.includes("--update");
  const { default: dbConnect } = await import("@/lib/db");
  const { DEFAULT_PACKAGES } = await import("@/lib/packages");
  const models = await Promise.all([
    import("@/models/User"),
    import("@/models/AuthChallenge"),
    import("@/models/RateLimit"),
    import("@/models/CreditPackage"),
    import("@/models/CreditTransaction"),
    import("@/models/Order"),
    import("@/models/GeneratedContent"),
    import("@/models/Document"),
  ]);

  await dbConnect();
  console.log(`Connected to "${mongoose.connection.db?.databaseName}".`);

  for (const { default: model } of models) {
    await model.syncIndexes();
    console.log(`  ✓ indexes: ${model.collection.collectionName}`);
  }

  const CreditPackage = models[3].default;
  for (const pkg of DEFAULT_PACKAGES) {
    const values = { ...pkg, features: [...pkg.features] };
    const result = await CreditPackage.updateOne(
      { slug: pkg.slug },
      update ? { $set: values } : { $setOnInsert: values },
      { upsert: true },
    );
    const action = result.upsertedCount ? "created" : update && result.modifiedCount ? "updated" : "unchanged";
    console.log(`  ✓ package ${pkg.slug}: ${action}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
