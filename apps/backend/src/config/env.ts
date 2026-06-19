import 'dotenv/config';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: num(process.env.PORT, 4000),
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
