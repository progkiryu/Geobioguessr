import { env } from './config/env.js';
import { connectMongo, closeMongo } from './db/mongo.js';
import { getRedis, closeRedis, pingRedis } from './db/redis.js';
import { loadFigures } from './services/figureService.js';
import { createApp } from './app.js';

async function initDataStores() {
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
}

async function main() {
  // Start listening first so the host platform (e.g. Render) immediately detects
  // the open port, then connect to the data stores. A DB failure is logged but
  // doesn't stop the server booting — the process stays up and DB-backed routes
  // simply return errors until connectivity is restored.
  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[startup] Geobioguessr API listening on port ${env.port}`);
  });

  try {
    await initDataStores();
  } catch (err) {
    console.error('[startup] data store initialization failed:', err);
    console.error('[startup] server is running, but database-backed routes will fail until this is fixed.');
  }

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
