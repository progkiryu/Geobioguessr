import Redis from 'ioredis';
import { env } from '../config/env.js';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(env.redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
  });
  client.on('error', (err) => {
    console.error('[redis] error:', err.message);
  });
  return client;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const res = await getRedis().ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await client?.quit();
  client = null;
}
