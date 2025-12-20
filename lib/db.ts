import mongoose from "mongoose";
const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URL;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI or MONGODB_URL");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts: any = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(MONGODB_URI as string, opts).catch((err) => {
      console.error("Mongo connection error:", err);
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
