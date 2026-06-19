import { env } from './config/env.js';
import { connectMongo, closeMongo } from './db/mongo.js';
import { getRedis, closeRedis, pingRedis } from './db/redis.js';
import { loadFigures } from './services/figureService.js';
import { createApp } from './app.js';

async function main() {
  console.log('[startup] connecting to MongoDB...');
  await connectMongo();

  console.log('[startup] connecting to Redis...');
  getRedis();
  const redisOk = await pingRedis();
  console.log(`[startup] Redis ${redisOk ? 'connected' : 'NOT reachable'}`);

  const count = await loadFigures();
  console.log(`[startup] loaded ${count} historical figures into memory`);
  if (count === 0) {
    console.warn('[startup] WARNING: no figures found. Run `pnpm seed` to populate the database.');
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[startup] Geobiograph API listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[shutdown] received ${signal}, closing...`);
    server.close();
    await Promise.allSettled([closeMongo(), closeRedis()]);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[fatal] failed to start server:', err);
  process.exit(1);
});
