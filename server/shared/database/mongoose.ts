import mongoose, { Mongoose } from 'mongoose';

/**
 * Mongoose connection singleton — dev hot-reload safe (global cache) and
 * production-safe (single connection per server process). The auth guard and
 * repositories await this before touching collections.
 */
const globalForMongoose = globalThis as unknown as {
  __moveUpMongoose?: Promise<Mongoose>;
};

export function connectMongo(): Promise<Mongoose> {
  if (globalForMongoose.__moveUpMongoose) {
    return globalForMongoose.__moveUpMongoose;
  }

  // Lazy-import the validated env config to keep this module standalone.
  const { env } = require('../../config/env') as typeof import('../../config/env');
  const { MONGODB_URI: uri, MONGODB_DB_NAME: dbName } = env();

  // A failed attempt must not stay cached, or the server would keep failing
  // after the database comes back, until someone restarts it.
  globalForMongoose.__moveUpMongoose = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 5_000,
      dbName,
    })
    .catch((error: unknown) => {
      globalForMongoose.__moveUpMongoose = undefined;
      throw error;
    });

  return globalForMongoose.__moveUpMongoose;
}

export { mongoose };
