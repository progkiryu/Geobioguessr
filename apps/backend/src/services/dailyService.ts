import { dailyChallenges } from '../db/mongo.js';
import { getRedis } from '../db/redis.js';
import { getAllFigures, getFigureById } from './figureService.js';
import { startGame, type PublicGameState } from './gameService.js';
import type { HistoricalFigure } from '../types.js';

/** UTC date key, e.g. "2026-06-18". */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve the date for a daily request. Clients send their local calendar day so
 * the Daily rolls over at the player's own midnight. We only honour a date within
 * one day of the server's UTC date (the widest real timezone offset is just under
 * ±1 day); anything else falls back to the UTC day, so future puzzles can't be
 * fetched early by sending an arbitrary date.
 */
export function resolveDailyDate(requested: unknown, now: Date = new Date()): string {
  if (typeof requested !== 'string' || !DATE_KEY_RE.test(requested)) return todayKey(now);
  const requestedMs = Date.parse(`${requested}T00:00:00Z`);
  if (Number.isNaN(requestedMs)) return todayKey(now);
  const dayMs = 86_400_000;
  const diffDays = Math.round((requestedMs - Date.parse(`${todayKey(now)}T00:00:00Z`)) / dayMs);
  return Math.abs(diffDays) <= 1 ? requested : todayKey(now);
}

/** Deterministic hash of a string to a non-negative integer. */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Resolve the figure for a given UTC date. The same date always maps to the
 * same figure for every player. Persisted in MongoDB and cached in Redis.
 */
export async function getDailyFigure(dateKey: string = todayKey()): Promise<HistoricalFigure> {
  const redis = getRedis();
  const cacheKey = `daily:${dateKey}`;

  try {
    const cachedId = await redis.get(cacheKey);
    if (cachedId) {
      const figure = getFigureById(cachedId);
      if (figure) return figure;
    }
  } catch {
    /* ignore cache errors */
  }

  // Persisted assignment?
  const existing = await dailyChallenges().findOne({ date: dateKey });
  if (existing) {
    const figure = getFigureById(existing.figureId);
    if (figure) {
      await safeCache(cacheKey, figure.id);
      return figure;
    }
  }

  // Deterministically assign a figure for this date and persist it.
  const figuresList = getAllFigures();
  if (figuresList.length === 0) throw new Error('No figures loaded.');
  const index = hashString(dateKey) % figuresList.length;
  const chosen = figuresList[index];

  await dailyChallenges().updateOne(
    { date: dateKey },
    { $setOnInsert: { date: dateKey, figureId: chosen.id, createdAt: new Date() } },
    { upsert: true },
  );
  // Re-read in case of a race; whoever inserted first wins.
  const settled = await dailyChallenges().findOne({ date: dateKey });
  const figure = (settled && getFigureById(settled.figureId)) || chosen;
  await safeCache(cacheKey, figure.id);
  return figure;
}

async function safeCache(key: string, value: string): Promise<void> {
  try {
    // Cache until a bit past 24h; the key is date-specific so this is safe.
    await getRedis().set(key, value, 'EX', 90_000);
  } catch {
    /* ignore */
  }
}

/** Start today's daily-challenge game. */
export async function startDailyGame(dateKey: string = todayKey()): Promise<PublicGameState> {
  const figure = await getDailyFigure(dateKey);
  return startGame(figure, 'daily', dateKey);
}
