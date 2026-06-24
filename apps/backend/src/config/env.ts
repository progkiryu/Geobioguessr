import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Load environment from the file that matches the run mode:
 *   NODE_ENV=production -> .env.prod   (cloud MongoDB / Redis)
 *   otherwise           -> .env.dev    (local services)
 *
 * Real hosting platforms inject their own env vars; dotenv does not override
 * variables that are already set, so those take precedence over the file.
 */
export const isProduction = process.env.NODE_ENV === 'production';
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
loadDotenv({ path: resolve(backendRoot, isProduction ? '.env.prod' : '.env.dev') });

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resolve the Redis connection string. Accepts either a ready-made REDIS_URL
 * (local dev) or discrete REDIS_HOST/PORT/USER/PASSWORD parts (Redis Cloud).
 * Set REDIS_TLS=true for endpoints that require TLS (rediss://).
 */
function resolveRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
  if (host && port) {
    const user = process.env.REDIS_USER || 'default';
    const pass = process.env.REDIS_PASSWORD || '';
    const scheme = process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
    const auth = pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
    return `${scheme}://${auth}${host}:${port}`;
  }

  return 'redis://localhost:6379';
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, isProduction ? 3000 : 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017',
  mongoDb: process.env.MONGO_DB ?? 'geobiograph',
  redisUrl: resolveRedisUrl(),
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
