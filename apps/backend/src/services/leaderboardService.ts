import { leaderboards } from '../db/mongo.js';
import { getRedis } from '../db/redis.js';
import type { GameSession, HistoricalFigure, LeaderboardEntry } from '../types.js';

const sessionKey = (gameId: string) => `game:${gameId}`;

export interface SubmitScoreResult {
  ok: boolean;
  reason?: string;
  rank?: number;
  entry?: LeaderboardEntry;
}

/**
 * Record a finished, solved game on the leaderboard. Validates against the
 * stored session so clients can't submit arbitrary scores.
 */
export async function submitScore(
  gameId: string,
  name: string,
  figure: HistoricalFigure,
): Promise<SubmitScoreResult> {
  const raw = await getRedis().get(sessionKey(gameId));
  if (!raw) return { ok: false, reason: 'Game not found or expired.' };
  const session = JSON.parse(raw) as GameSession;

  if (!session.over) return { ok: false, reason: 'Game is not finished.' };
  if (!session.solved) return { ok: false, reason: 'Only solved games can be ranked.' };

  const cleanName = name.trim().slice(0, 24) || 'Anonymous';
  const entry: LeaderboardEntry = {
    mode: session.mode,
    date: session.date,
    name: cleanName,
    score: session.score ?? 0,
    attempts: session.attempts,
    figureId: session.figureId,
    figureName: figure.name,
    createdAt: new Date(),
  };

  await leaderboards().insertOne(entry);

  // Rank = number of strictly higher scores in the same board + 1.
  const higher = await leaderboards().countDocuments({
    mode: entry.mode,
    date: entry.date ?? { $exists: false },
    score: { $gt: entry.score },
  });

  return { ok: true, rank: higher + 1, entry };
}

/** Top scores for a board (mode + optional daily date). */
export async function getLeaderboard(
  mode: 'random' | 'daily',
  date: string | undefined,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const filter: Record<string, unknown> = { mode };
  if (mode === 'daily' && date) filter.date = date;
  return leaderboards()
    .find(filter, { projection: { _id: 0 } })
    .sort({ score: -1, createdAt: 1 })
    .limit(limit)
    .toArray();
}
