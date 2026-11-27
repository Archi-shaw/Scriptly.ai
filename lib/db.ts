import "server-only";
import mongoose from "mongoose";
import { getMongoUri } from "@/lib/config";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  supportsTransactions: boolean | null;
};

// Reuse one connection across hot reloads and serverless invocations.
const globalWithMongoose = globalThis as typeof globalThis & { _mongooseCache?: MongooseCache };
const cache: MongooseCache =
  globalWithMongoose._mongooseCache ??
  (globalWithMongoose._mongooseCache = { conn: null, promise: null, supportsTransactions: null });

export class DatabaseConfigError extends Error {
  constructor() {
    super("MONGODB_URI is not configured");
    this.name = "DatabaseConfigError";
  }
}

export default async function dbConnect(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  const uri = getMongoUri();
  if (!uri) throw new DatabaseConfigError();

  // After an explicit disconnect the cached promise is stale: connect again.
  if (mongoose.connection.readyState === 0) cache.promise = null;

  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8_000,
      maxPoolSize: 10,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}

/** Transactions need a replica set or sharded cluster (Atlas always qualifies). */
export async function supportsTransactions(): Promise<boolean> {
  if (cache.supportsTransactions !== null) return cache.supportsTransactions;
  await dbConnect();
  try {
    const db = mongoose.connection.db;
    if (!db) return false;
    const hello = await db.admin().command({ hello: 1 });
    cache.supportsTransactions = Boolean(hello.setName) || hello.msg === "isdbgrid";
  } catch {
    cache.supportsTransactions = false;
  }
  return cache.supportsTransactions;
}

/**
 * Runs `fn` inside a transaction when the deployment supports it. On a
 * standalone server it runs without one; callers order their writes so the
 * non-transactional path stays safe (conditional updates + unique keys).
 */
export async function withOptionalTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>,
): Promise<T> {
  await dbConnect();
  if (!(await supportsTransactions())) return fn(null);

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}
