import mongoose from "mongoose";

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};
const globalForMongoose = globalThis as unknown as { _mongoose?: Cached };
const cached: Cached = globalForMongoose._mongoose ?? {
  conn: null,
  promise: null,
};
globalForMongoose._mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri)
    throw new Error(
      "Missing MONGODB_URI. Copy .env.example to .env.local and set it.",
    );
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
