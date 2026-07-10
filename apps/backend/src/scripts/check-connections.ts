import Redis from 'ioredis';
import { env, isProduction } from '../config/env.js';
import { connectMongo, closeMongo, figures } from '../db/mongo.js';

/**
 * Verifies connectivity to the production MongoDB and Redis services (the
 * localhost instances the VPS runs alongside the API, per .env.prod).
 *
 * Deliberately refuses to run unless NODE_ENV=production, so it always loads
 * .env.prod rather than the local dev config. Run with:
 *   pnpm check:prod
 */

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(unparseable url)';
  }
}

/** Connect a short-lived Redis client that fails fast (no endless reconnects). */
async function tryRedis(url: string): Promise<string> {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 8000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // don't loop forever on a bad endpoint
  });
  try {
    await client.connect();
    const pong = await client.ping();
    const key = 'healthcheck:connection';
    await client.set(key, 'ok', 'EX', 10);
    const value = await client.get(key);
    await client.del(key);
    return `ping=${pong}, set/get=${value}`;
  } finally {
    client.disconnect();
  }
}

async function main() {
  if (!isProduction) {
    console.error(
      '✗ Refusing to run: set NODE_ENV=production. This check only targets the prod cloud services.',
    );
    process.exit(1);
  }

  console.log('[check] running production connectivity check...\n');
  let ok = true;

  // ---- MongoDB ----
  console.log(`[mongo] connecting to ${maskUrl(env.mongoUrl)} (db: ${env.mongoDb})`);
  try {
    const db = await connectMongo();
    await db.command({ ping: 1 });
    const count = await figures().countDocuments();
    console.log(`[mongo] ✓ OK — ping succeeded, ${count} figures in "${env.mongoDb}"`);
    if (count === 0) {
      console.log('[mongo]   note: collection is empty — run `pnpm seed:prod` to populate it.');
    }
  } catch (err) {
    ok = false;
    console.error(`[mongo] ✗ FAILED — ${(err as Error).message}`);
  } finally {
    await closeMongo().catch(() => {});
  }

  console.log('');

  // ---- Redis ----
  console.log(`[redis] connecting to ${maskUrl(env.redisUrl)}`);
  try {
    const result = await tryRedis(env.redisUrl);
    console.log(`[redis] ✓ OK — ${result}`);
  } catch (err) {
    ok = false;
    console.error(`[redis] ✗ FAILED — ${(err as Error).message}`);
  }

  console.log(`\n[check] ${ok ? '✓ all connections OK' : '✗ one or more connections failed'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[check] unexpected error:', err);
  process.exit(1);
});
