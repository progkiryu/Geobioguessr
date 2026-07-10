import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Load environment from the file that matches the run mode:
 *   NODE_ENV=production -> .env.prod   (VPS: MongoDB/Redis on localhost)
 *   otherwise           -> .env.dev    (local dev services)
 *
 * A process manager or shell can inject env vars directly; dotenv does not
 * override variables that are already set, so those take precedence over the file.
 */
export const isProduction = process.env.NODE_ENV === 'production';
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
loadDotenv({ path: resolve(backendRoot, isProduction ? '.env.prod' : '.env.dev') });

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, isProduction ? 3000 : 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017',
  mongoDb: process.env.MONGO_DB ?? 'geobiograph',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  searchCacheTtl: num(process.env.SEARCH_CACHE_TTL, 300),
  gameSessionTtl: num(process.env.GAME_SESSION_TTL, 86400),
} as const;

export const GAME = {
  maxAttempts: 7,
  totalHints: 6,
  baseScore: 1000,
  penaltyPerWrongGuess: 150,
  firstGuessBonus: 500,
  minScore: 0,
} as const;
