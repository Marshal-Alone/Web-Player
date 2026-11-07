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

const DEFAULT_MONGO_URI =
  'mongodb+srv://trylaptop2024:trylaptop2024@cluster0.q8qtgtu.mongodb.net/course_player?appName=Cluster0';

export const env: AppEnv = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  HOST: process.env.HOST || '127.0.0.1',
  MONGO_URI: process.env.MONGO_URI || DEFAULT_MONGO_URI,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
