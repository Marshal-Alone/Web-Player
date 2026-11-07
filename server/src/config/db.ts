import mongoose from 'mongoose';
import { env } from './env.js';

let isConnecting = false;

// Setup mongoose connection event logging
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Successfully connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from MongoDB');
});

export async function connectDB(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
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
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });
    isConnecting = false;
    return conn;
  } catch (error) {
    isConnecting = false;
    console.error('[MongoDB] Failed to connect to MongoDB:', error);
    throw error;
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
