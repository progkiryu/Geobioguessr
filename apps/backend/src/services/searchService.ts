import { env } from '../config/env.js';
import { getRedis } from '../db/redis.js';
import { searchFigures } from './figureService.js';
import type { SearchResult } from '../types.js';

/**
 * Search suggestions with Redis caching (one of the spec's Redis use cases).
 * Falls back gracefully to a direct in-memory search if Redis is unavailable.
 */
export async function getSearchSuggestions(query: string, limit = 8): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const cacheKey = `search:${limit}:${q}`;
  const redis = getRedis();

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as SearchResult[];
  } catch {
    // ignore cache read failure
  }

  const results: SearchResult[] = searchFigures(q, limit).map((f) => ({
    id: f.id,
    name: f.name,
  }));

  try {
    await redis.set(cacheKey, JSON.stringify(results), 'EX', env.searchCacheTtl);
  } catch {
    // ignore cache write failure
  }

  return results;
}
