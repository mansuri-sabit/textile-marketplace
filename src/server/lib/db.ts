import mongoose from "mongoose";
import { env } from "./env";

/**
 * Serverless-safe Mongoose connection.
 *
 * Next.js route handlers run in short-lived isolates that are frequently reused.
 * Without caching, every invocation opens a new pool and Atlas hits its
 * connection ceiling under load. We stash the connection promise on globalThis
 * so it survives hot reloads in dev and warm invocations in production.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalCache = globalThis as typeof globalThis & {
  __mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalCache.__mongooseCache ?? {
  conn: null,
  promise: null,
};
globalCache.__mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const { MONGODB_URI, MONGODB_DB } = env();

    mongoose.set("strictQuery", true);

    cache.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      // Fail fast rather than hanging a request for 30s on a bad cluster.
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      minPoolSize: 0,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Reset so the next request retries instead of reusing a rejected promise.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
