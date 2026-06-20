import { analytics } from '../db/mongo.js';
import { GAME } from '../config/env.js';
import { computeScore } from '../utils/score.js';
import { todayKey } from './dailyService.js';

export interface ScoreBucket {
  score: number;
  count: number;
}

export interface DailyStats {
  date: string;
  /** Total finished daily games (each completion is one data point). */
  total: number;
  /** How many of those were solved. */
  solved: number;
  /** Count of completions per attainable score, ascending by score. */
  distribution: ScoreBucket[];
}

/**
 * The full set of scores a finished game can produce, given the scoring rules.
 * Enumerated so the distribution always has a stable set of bars, even for
 * scores nobody has hit yet (count 0). Failed games score `minScore`.
 */
function attainableScores(): number[] {
  const scores = new Set<number>([computeScore(0, false)]);
  for (let wrong = 0; wrong < GAME.maxAttempts; wrong++) {
    scores.add(computeScore(wrong, true));
  }
  return [...scores].sort((a, b) => a - b);
}

/**
 * Score distribution for a given day's Daily challenge — i.e. how many people
 * achieved each score on the figure everyone shares that day.
 */
export async function getDailyStats(dateKey: string = todayKey()): Promise<DailyStats> {
  const rows = await analytics()
    .aggregate<{ _id: number; count: number }>([
      { $match: { type: 'game_finished', mode: 'daily', date: dateKey } },
      { $group: { _id: '$score', count: { $sum: 1 } } },
    ])
    .toArray();

  const counts = new Map<number, number>();
  for (const row of rows) counts.set(Number(row._id), row.count);

  const distribution: ScoreBucket[] = attainableScores().map((score) => ({
    score,
    count: counts.get(score) ?? 0,
  }));
  const total = distribution.reduce((sum, b) => sum + b.count, 0);
  const solved = distribution.filter((b) => b.score > GAME.minScore).reduce((sum, b) => sum + b.count, 0);

  return { date: dateKey, total, solved, distribution };
}
