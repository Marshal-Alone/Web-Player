import mongoose from 'mongoose';
import { env, LOCAL_MONGO_URI, ATLAS_FALLBACK_MONGO_URI } from './env.js';

let isConnecting = false;

// Setup mongoose connection event logging
mongoose.connection.on('connected', () => {
  const host = mongoose.connection.host;
  console.log(`[MongoDB] Successfully connected to MongoDB database (${host})`);
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from MongoDB');
});

export async function connectDB(targetUri?: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (isConnecting) {
    // Wait for in-flight connection
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (mongoose.connection.readyState === 1 || !isConnecting) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    });
    return mongoose;
  }

  isConnecting = true;

  // 1. If explicit URI passed or MONGO_URI is set in process.env
  const explicitUri = targetUri || process.env.MONGO_URI;
  if (explicitUri && !explicitUri.includes('127.0.0.1') && !explicitUri.includes('localhost')) {
    try {
      console.log(`[MongoDB] Connecting to configured MONGO_URI (${explicitUri.replace(/\/\/.*@/, '//***@')})...`);
      const conn = await mongoose.connect(explicitUri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        maxPoolSize: 10
      });
      isConnecting = false;
      return conn;
    } catch (err) {
      console.warn('[MongoDB] Failed to connect to configured remote MONGO_URI. Attempting local MongoDB fallback...', err);
    }
  }

  // 2. Default / Local-first: Attempt local MongoDB first
  const localTarget = (explicitUri && (explicitUri.includes('127.0.0.1') || explicitUri.includes('localhost')))
    ? explicitUri
    : LOCAL_MONGO_URI;

  try {
    console.log(`[MongoDB] Attempting to connect to local MongoDB at ${localTarget}...`);
    const conn = await mongoose.connect(localTarget, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      maxPoolSize: 10
    });
    isConnecting = false;
    console.log(`[MongoDB] Successfully connected to local MongoDB (${localTarget})`);
    return conn;
  } catch (localErr: any) {
    if (ATLAS_FALLBACK_MONGO_URI) {
      console.warn(`[MongoDB] Local MongoDB not reachable at ${localTarget}. Falling back to configured Atlas fallback...`);
      try {
        const conn = await mongoose.connect(ATLAS_FALLBACK_MONGO_URI, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
          maxPoolSize: 10
        });
        isConnecting = false;
        console.log('[MongoDB] Successfully connected to fallback MongoDB Atlas cluster');
        return conn;
      } catch (atlasErr) {
        isConnecting = false;
        console.error('[MongoDB] Both local MongoDB and fallback Atlas connection failed:', atlasErr);
        throw atlasErr;
      }
    }

    isConnecting = false;
    console.error(`[MongoDB] Failed to connect to local MongoDB at ${localTarget}. Please ensure MongoDB service is running or set MONGO_URI in your environment.`);
    throw localErr;
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[MongoDB] Connection closed successfully');
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
