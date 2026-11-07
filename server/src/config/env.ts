import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env relative to server root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppEnv {
  PORT: number;
  HOST: string;
  MONGO_URI: string;
  NODE_ENV: string;
}

export const LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/course_player';
export const ATLAS_FALLBACK_MONGO_URI = process.env.ATLAS_FALLBACK_MONGO_URI || '';

export const env: AppEnv = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  HOST: process.env.HOST || '127.0.0.1',
  MONGO_URI: process.env.MONGO_URI || LOCAL_MONGO_URI,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
