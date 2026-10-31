import mongoose, { Mongoose } from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Mongoose connection singleton — dev hot-reload safe (global cache) and
 * production-safe (single connection per server process). The auth guard and
 * repositories await this before touching collections.
 */
const globalForMongoose = globalThis as unknown as {
  __moveUpMongoose?: Promise<Mongoose>;
  __moveUpMongoMemoryServer?: MongoMemoryServer;
};

function isConnectionRefusedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === 'ECONNREFUSED' || (typeof message === 'string' && message.includes('ECONNREFUSED'));
}

export async function connectMongo(): Promise<Mongoose> {
  if (globalForMongoose.__moveUpMongoose) {
    return globalForMongoose.__moveUpMongoose;
  }

  // Lazy-import the validated env config to keep this module standalone.
  const { env } = require('../../config/env') as typeof import('../../config/env');
  const connectOptions = {
    serverSelectionTimeoutMS: 5_000,
    dbName: 'moveup',
  };

  let uri = env().MONGODB_URI;

  try {
    globalForMongoose.__moveUpMongoose = mongoose.connect(uri, connectOptions);
    return await globalForMongoose.__moveUpMongoose;
  } catch (error) {
    if (!isConnectionRefusedError(error) || !uri.includes('localhost')) {
      throw error;
    }

    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const memoryServer = await MongoMemoryServer.create({
      binary: { version: '7.0.14' },
      instance: { dbName: 'moveup' },
    });

    globalForMongoose.__moveUpMongoMemoryServer = memoryServer;
    uri = memoryServer.getUri('moveup');
    globalForMongoose.__moveUpMongoose = mongoose.connect(uri, connectOptions);
    return await globalForMongoose.__moveUpMongoose;
  }
}

export { mongoose };
