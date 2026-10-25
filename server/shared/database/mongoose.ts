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
  const uri = env().MONGODB_URI;

  globalForMongoose.__moveUpMongoose = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
    dbName: 'moveup',
  });

  return globalForMongoose.__moveUpMongoose;
}

export { mongoose };
